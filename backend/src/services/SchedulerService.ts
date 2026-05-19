import * as cron from 'node-cron'
import { FieldPath } from 'firebase-admin/firestore'
import { db } from '../index'
import { francisByrneAdapter } from '../adapters/FrancisByrneAdapter'
import { ezLinksAdapter } from '../adapters/EzLinksAdapter'
import { notificationService } from './NotificationService'
import { weatherService } from './WeatherService'
import { COURSE_LOCATION_BY_SCHEDULE, DEFAULT_PREFERENCES, SCHEDULE_SOURCE } from '../constants'
import { Preferences, CheckRecord, SchedulerStatus, TeeTime, Reservation, TeeTimeSource, StoredTeeTime, TeeTimeActiveIndex, TeeTimeWeather } from '../types'

function sourceFor(scheduleId: string): TeeTimeSource {
  return SCHEDULE_SOURCE[scheduleId] ?? 'foreup'
}

function adapterFor(scheduleId: string) {
  return sourceFor(scheduleId) === 'ezlinks' ? ezLinksAdapter : francisByrneAdapter
}

function dedupKey(t: Pick<TeeTime, 'source' | 'scheduleId' | 'date' | 'time'>): string {
  return `${t.source}_${t.scheduleId}_${t.date}_${t.time}`
}
import { resolveWeatherLocationFromTimes, resolveWeatherScheduleIdFromTimes } from '../utils/weatherLocation'
import { buildDateKeysInTimeZone } from '../utils/dateKeys'

const DAILY_WEATHER_STATE_COLLECTION = 'notificationState'
const DAILY_WEATHER_STATE_DOC_ID = 'dailyWeatherSummary'
const DAILY_WEATHER_DAYS = 14
const DAILY_WEATHER_AM_HOUR = 6
const DAILY_WEATHER_PM_HOUR = 15

interface DailyWeatherSummaryRunResult {
  sent: boolean
  reason?: string
  scheduleId?: string
  dayCount?: number
}

interface TeeTimeNotificationTestRunResult {
  sent: boolean
  reason?: string
  totalFound: number
  notified: number
  errors: string[]
}


function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]!
}

function toDateStringInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getHourInTimeZone(date: Date, timeZone: string): number | null {
  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(date)
  const hour = Number.parseInt(raw, 10)
  if (Number.isNaN(hour) || hour < 0 || hour > 23) {
    return null
  }
  return hour
}

function getDailyWeatherSlot(date: Date, timeZone: string): '06' | '15' | null {
  const hour = getHourInTimeZone(date, timeZone)
  if (hour === null) return null
  if (hour >= DAILY_WEATHER_PM_HOUR) return '15'
  if (hour >= DAILY_WEATHER_AM_HOUR) return '06'
  return null
}

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim()

  const m12 = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i)
  if (m12) {
    const rawHour = parseInt(m12[1]!, 10)
    const minute = parseInt(m12[2]!, 10)
    const suffix = m12[3]!.toUpperCase()
    if (Number.isNaN(rawHour) || Number.isNaN(minute) || minute < 0 || minute > 59 || rawHour < 1 || rawHour > 12) {
      return null
    }
    const hour24 = (rawHour % 12) + (suffix === 'PM' ? 12 : 0)
    return hour24 * 60 + minute
  }

  const m24 = trimmed.match(/(?:^|[ T])(\d{1,2}):(\d{2})(?::\d{2})?\s*$/)
  if (m24) {
    const hour = parseInt(m24[1]!, 10)
    const minute = parseInt(m24[2]!, 10)
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null
    }
    return hour * 60 + minute
  }

  return null
}

function isInTimeRange(time: string, start: string, end: string): boolean {
  const t = parseTimeToMinutes(time)
  const s = parseTimeToMinutes(start)
  const e = parseTimeToMinutes(end)
  if (t === null || s === null || e === null) {
    return false
  }
  return t >= s && t <= e
}

export class SchedulerService {
  private cronJob: cron.ScheduledTask | null = null
  private status: SchedulerStatus = {
    isRunning: false,
    lastCheck: null,
    nextCheck: null,
    lastCheckResult: null,
  }
  private isChecking = false

  start(intervalMinutes: number): void {
    this.stop()
    const expr = `*/${intervalMinutes} * * * *`
    this.cronJob = cron.schedule(expr, () => {
      this.runCheck().catch(err => console.error('Scheduler check failed:', err))
    })
    this.status.isRunning = true
    this.status.nextCheck = this.calcNextCheck(intervalMinutes)
    console.log(`Scheduler started: ${expr}`)
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop()
      this.cronJob = null
    }
    this.status.isRunning = false
    this.status.nextCheck = null
  }

  restart(intervalMinutes: number): void {
    this.start(intervalMinutes)
  }

  getStatus(): SchedulerStatus {
    return { ...this.status }
  }

  private async enrichTimesWithWeather(
    scheduleId: string,
    date: string,
    times: TeeTime[],
    forecastOffsetHours: number
  ): Promise<TeeTime[]> {
    const location = resolveWeatherLocationFromTimes(times, scheduleId)
    if (!location || times.length === 0) {
      return times
    }

    return Promise.all(
      times.map(async (teeTime): Promise<TeeTime> => {
        try {
          const weather = await weatherService.getWeatherForTeeTime(location, date, teeTime.time, forecastOffsetHours)
          return weather ? { ...teeTime, weather } : teeTime
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          console.warn(`[Scheduler] Weather enrichment failed schedule=${scheduleId} date=${date}: ${message}`)
          return teeTime
        }
      })
    )
  }

  private async prefetchWeatherForCheck(scheduleIds: string[], dates: string[]): Promise<void> {
    if (scheduleIds.length === 0 || dates.length === 0) return
    const locationsByKey = new Map<string, { latitude: number; longitude: number; timezone: string }>()
    const snap = (v: number) => (Math.round(v / 0.1) * 0.1).toFixed(2)
    for (const scheduleId of scheduleIds) {
      const location = COURSE_LOCATION_BY_SCHEDULE[scheduleId]
      if (!location) continue
      const key = `${snap(location.latitude)},${snap(location.longitude)},${location.timezone}`
      if (!locationsByKey.has(key)) {
        locationsByKey.set(key, location)
      }
    }
    await Promise.all(
      [...locationsByKey.values()].map(location =>
        weatherService.prefetchHourlyForDates(location, dates).catch(err => {
          const message = err instanceof Error ? err.message : String(err)
          console.warn(`[Scheduler] Weather prefetch failed: ${message}`)
        })
      )
    )
  }

  /**
   * Persists the lifecycle snapshot for a (source, scheduleId, date) and returns
   * a map of doc IDs to the StoredTeeTime that reflects post-upsert state. Caller
   * uses this for notification decisions (checking notifiedAt).
   *
   * - Upserts each observed time as status='active', preserving firstSeenAt and notifiedAt.
   * - Marks previously-active times that disappeared as status='inactive'.
   * - Updates the teeTimeActive index doc.
   */
  private async persistLifecycleSnapshot(
    source: TeeTimeSource,
    scheduleId: string,
    date: string,
    observed: TeeTime[],
    inWindowWithWeather: TeeTime[]
  ): Promise<Map<string, StoredTeeTime>> {
    const now = new Date()
    const indexRef = db.collection('teeTimeActive').doc(`${source}_${scheduleId}_${date}`)

    const weatherByTime = new Map<string, TeeTimeWeather>()
    for (const t of inWindowWithWeather) {
      if (t.weather) weatherByTime.set(t.time, t.weather)
    }

    const indexSnap = await indexRef.get()
    const previouslyActive: string[] = indexSnap.exists
      ? ((indexSnap.data() as TeeTimeActiveIndex | undefined)?.activeTimes ?? [])
      : []

    const currentActive = observed.map(t => t.time)
    const currentActiveSet = new Set(currentActive)

    const observedDocIds = observed.map(t => dedupKey(t))
    const existingByDocId = new Map<string, StoredTeeTime | null>()
    if (observedDocIds.length > 0) {
      const refs = observedDocIds.map(id => db.collection('teeTimes').doc(id))
      const snaps = await db.getAll(...refs)
      snaps.forEach((snap, i) => {
        const id = observedDocIds[i]!
        existingByDocId.set(id, snap.exists ? (snap.data() as StoredTeeTime) : null)
      })
    }

    const resultMap = new Map<string, StoredTeeTime>()

    let upsertBatch = db.batch()
    let upsertOps = 0
    for (const t of observed) {
      const docId = dedupKey(t)
      const existing = existingByDocId.get(docId) ?? null
      const weather = weatherByTime.get(t.time) ?? t.weather
      const doc: StoredTeeTime = {
        source: t.source,
        scheduleId: t.scheduleId,
        ...(t.scheduleName !== undefined && { scheduleName: t.scheduleName }),
        date: t.date,
        time: t.time,
        availableSpots: t.availableSpots,
        ...(t.price !== undefined && { price: t.price }),
        ...(weather && { weather }),
        status: 'active',
        firstSeenAt: existing?.firstSeenAt ?? now,
        lastSeenAt: now,
        disappearedAt: null,
        notifiedAt: existing?.notifiedAt ?? null,
      }
      upsertBatch.set(db.collection('teeTimes').doc(docId), doc)
      upsertOps++
      resultMap.set(docId, doc)
      if (upsertOps >= 450) {
        await upsertBatch.commit()
        upsertBatch = db.batch()
        upsertOps = 0
      }
    }
    if (upsertOps > 0) await upsertBatch.commit()

    const disappeared = previouslyActive.filter(time => !currentActiveSet.has(time))
    if (disappeared.length > 0) {
      let batch = db.batch()
      let ops = 0
      for (const time of disappeared) {
        const docId = `${source}_${scheduleId}_${date}_${time}`
        batch.update(db.collection('teeTimes').doc(docId), {
          status: 'inactive',
          disappearedAt: now,
          lastSeenAt: now,
        })
        ops++
        if (ops >= 450) {
          await batch.commit()
          batch = db.batch()
          ops = 0
        }
      }
      if (ops > 0) await batch.commit()
    }

    await indexRef.set({ activeTimes: currentActive, updatedAt: now })

    return resultMap
  }

  private async sendDailyWeatherSummaryIfNeeded(
    prefs: Preferences,
    searchedTimes: TeeTime[],
    forceSend: boolean = false
  ): Promise<DailyWeatherSummaryRunResult> {
    if (!prefs.discordWebhookUrl) {
      return { sent: false, reason: 'No Discord webhook URL configured' }
    }

    const fallbackScheduleId = prefs.scheduleIds[0] ?? DEFAULT_PREFERENCES.scheduleIds[0] ?? '11078'
    const selectedScheduleId = resolveWeatherScheduleIdFromTimes(searchedTimes, fallbackScheduleId)
    const location = COURSE_LOCATION_BY_SCHEDULE[selectedScheduleId]
    if (!location) {
      console.warn(`[Scheduler] Daily weather summary skipped: no weather location for schedule=${selectedScheduleId}`)
      return { sent: false, reason: 'No weather location configured for selected schedule', scheduleId: selectedScheduleId }
    }

    const now = new Date()
    const todayKey = toDateStringInTimeZone(now, location.timezone)
    const slot = getDailyWeatherSlot(now, location.timezone)
    const stateRef = db.collection(DAILY_WEATHER_STATE_COLLECTION).doc(DAILY_WEATHER_STATE_DOC_ID)
    const stateDoc = await stateRef.get()
    const stateData = stateDoc.data()
    const lastSentSlotKey = stateData?.['lastSentSlotKey'] as string | undefined
    if (!forceSend && slot === null) {
      return { sent: false, reason: 'Outside send window (before 6am local)', scheduleId: selectedScheduleId }
    }
    const slotKey = `${todayKey}_${slot ?? 'manual'}`
    if (!forceSend && lastSentSlotKey === slotKey) {
      return { sent: false, reason: 'Already sent for current time slot', scheduleId: selectedScheduleId }
    }

    const dateKeys = buildDateKeysInTimeZone(now, DAILY_WEATHER_DAYS, location.timezone)
    const weatherByDate = await weatherService.getDailyWeatherRange(location, dateKeys)
    const days = dateKeys.map(date => ({ date, weather: weatherByDate.get(date) ?? null }))

    await notificationService.sendDailyWeatherSummary(prefs.discordWebhookUrl, days, prefs.weatherThresholds)

    await stateRef.set(
      {
        lastSentDateKey: todayKey,
        lastSentSlotKey: slotKey,
        lastSentAt: new Date(),
        timezone: location.timezone,
        scheduleId: selectedScheduleId,
      },
      { merge: true }
    )

    return { sent: true, scheduleId: selectedScheduleId, dayCount: days.length }
  }

  private async collectSearchTimesForFallback(prefs: Preferences, date: string): Promise<TeeTime[]> {
    const allTimes: TeeTime[] = []
    for (const scheduleId of prefs.scheduleIds) {
      try {
        const times = await adapterFor(scheduleId).searchTeeTimes([scheduleId], {
          date,
          players: prefs.players,
        })
        allTimes.push(...times)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[Scheduler] Fallback search failed schedule=${scheduleId} date=${date}: ${message}`)
      }
    }
    return allTimes
  }

  async runDailyWeatherSummary(forceSend: boolean = true): Promise<DailyWeatherSummaryRunResult> {
    const prefsDoc = await db.collection('preferences').doc('user').get()
    if (!prefsDoc.exists) {
      return { sent: false, reason: 'No preferences configured' }
    }

    const rawPrefs = prefsDoc.data() as Partial<Preferences>
    const prefs: Preferences = {
      ...DEFAULT_PREFERENCES,
      ...rawPrefs,
      weatherThresholds: {
        ...DEFAULT_PREFERENCES.weatherThresholds,
        ...(rawPrefs.weatherThresholds ?? {}),
      },
    }

    const searchDate = toDateString(new Date())
    const searchedTimes = await this.collectSearchTimesForFallback(prefs, searchDate)
    return this.sendDailyWeatherSummaryIfNeeded(prefs, searchedTimes, forceSend)
  }

  async runTeeTimeNotificationTest(): Promise<TeeTimeNotificationTestRunResult> {
    const errors: string[] = []
    const prefsDoc = await db.collection('preferences').doc('user').get()
    if (!prefsDoc.exists) {
      return { sent: false, reason: 'No preferences configured', totalFound: 0, notified: 0, errors }
    }

    const rawPrefs = prefsDoc.data() as Partial<Preferences>
    const prefs: Preferences = {
      ...DEFAULT_PREFERENCES,
      ...rawPrefs,
      weatherThresholds: {
        ...DEFAULT_PREFERENCES.weatherThresholds,
        ...(rawPrefs.weatherThresholds ?? {}),
      },
    }

    if (!prefs.discordWebhookUrl) {
      return { sent: false, reason: 'No Discord webhook URL configured', totalFound: 0, notified: 0, errors }
    }

    const todayStr = toDateString(new Date())
    const dates = (prefs.specificDates || []).filter(d => d >= todayStr)

    await this.prefetchWeatherForCheck(prefs.scheduleIds, dates)

    const matchingTimes: TeeTime[] = []
    for (const scheduleId of prefs.scheduleIds) {
      for (const date of dates) {
        try {
          const times = await adapterFor(scheduleId).searchTeeTimes([scheduleId], {
            date,
            players: prefs.players,
          })
          const inWindow = times.filter(t =>
            isInTimeRange(t.time, prefs.timeRange.start, prefs.timeRange.end)
          )
          const inWindowWithWeather = await this.enrichTimesWithWeather(
            scheduleId,
            date,
            inWindow,
            prefs.forecastOffsetHours
          )
          matchingTimes.push(...inWindowWithWeather)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push(`Error checking schedule ${scheduleId} for ${date}: ${message}`)
        }
      }
    }

    if (matchingTimes.length === 0) {
      return {
        sent: false,
        reason: 'No tee times found in current monitoring window',
        totalFound: 0,
        notified: 0,
        errors,
      }
    }

    await notificationService.sendTeeTimeAlert(
      prefs.discordWebhookUrl,
      matchingTimes,
      prefs.weatherThresholds
    )

    return {
      sent: true,
      totalFound: matchingTimes.length,
      notified: matchingTimes.length,
      errors,
    }
  }

  async runCheck(): Promise<CheckRecord> {
    if (this.isChecking) {
      console.log('Check already in progress, skipping')
      return {
        timestamp: new Date(),
        schedulesChecked: [],
        timesFound: 0,
        notified: 0,
        errors: ['Check already in progress'],
      }
    }

    this.isChecking = true
    const record: CheckRecord = {
      timestamp: new Date(),
      schedulesChecked: [],
      timesFound: 0,
      notified: 0,
      errors: [],
    }

    try {
      const prefsDoc = await db.collection('preferences').doc('user').get()
      if (!prefsDoc.exists) {
        record.errors.push('No preferences configured')
        return record
      }

      const rawPrefs = prefsDoc.data() as Partial<Preferences>
      const prefs: Preferences = {
        ...DEFAULT_PREFERENCES,
        ...rawPrefs,
        weatherThresholds: {
          ...DEFAULT_PREFERENCES.weatherThresholds,
          ...(rawPrefs.weatherThresholds ?? {}),
        },
      }

      if (!prefs.discordWebhookUrl) {
        record.errors.push('No Discord webhook URL configured')
      }

      // Build date list from explicitly selected upcoming dates
      const today = toDateString(new Date())
      const dates = (prefs.specificDates || []).filter(d => d >= today)

      const newMatches: TeeTime[] = []
      const newMatchDocIds: string[] = []
      const searchedTimes: TeeTime[] = []
      console.log(
        `[Scheduler] Starting check for schedules=${prefs.scheduleIds.join(',')} dates=${dates.join(',')} window=${prefs.timeRange.start}-${prefs.timeRange.end} players>=${prefs.players}`
      )

      await this.prefetchWeatherForCheck(prefs.scheduleIds, dates)

      record.schedulesChecked.push(...prefs.scheduleIds)
      for (const scheduleId of prefs.scheduleIds) {
        const source = sourceFor(scheduleId)
        for (const date of dates) {
          try {
            // Query one schedule at a time so each provider uses the right primary context.
            const times = await adapterFor(scheduleId).searchTeeTimes([scheduleId], {
              date,
              players: prefs.players,
            })
            searchedTimes.push(...times)

            const inWindow = times.filter(t =>
              isInTimeRange(t.time, prefs.timeRange.start, prefs.timeRange.end)
            )
            const inWindowWithWeather = await this.enrichTimesWithWeather(
              scheduleId,
              date,
              inWindow,
              prefs.forecastOffsetHours
            )

            const persisted = await this.persistLifecycleSnapshot(
              source,
              scheduleId,
              date,
              times,
              inWindowWithWeather
            )

            console.log(
              `[Scheduler] schedule=${scheduleId} date=${date} returned=${times.length} inWindow=${inWindowWithWeather.length} sampleTimes=${times.slice(0, 5).map(t => t.time).join(',') || 'none'}`
            )

            record.timesFound += inWindowWithWeather.length

            for (const t of inWindowWithWeather) {
              const docId = dedupKey(t)
              const stored = persisted.get(docId)
              if (stored?.notifiedAt) continue

              // Cutover: respect legacy notifiedTimes ledger to avoid a re-notification storm.
              // When we find a legacy hit, backfill notifiedAt on the new doc so behavior
              // survives eventual deletion of the legacy collection.
              const legacy = await db.collection('notifiedTimes').doc(docId).get()
              if (legacy.exists) {
                const legacyNotifiedAt = (legacy.data() as { notifiedAt?: Date } | undefined)?.notifiedAt ?? new Date()
                await db.collection('teeTimes').doc(docId).update({ notifiedAt: legacyNotifiedAt })
                continue
              }

              newMatches.push(t)
              newMatchDocIds.push(docId)
            }
          } catch (err: any) {
            const msg = `Error checking schedule ${scheduleId} for ${date}: ${err?.message}`
            record.errors.push(msg)
            console.error(msg)
          }
        }
      }

      try {
        await this.sendDailyWeatherSummaryIfNeeded(prefs, searchedTimes, false)
      } catch (err: any) {
        record.errors.push(`Daily weather summary failed: ${err?.message}`)
      }

      if (newMatches.length > 0 && prefs.discordWebhookUrl) {
        try {
          await notificationService.sendTeeTimeAlert(prefs.discordWebhookUrl, newMatches, prefs.weatherThresholds)
          record.notified = newMatches.length

          const now = new Date()
          let batch = db.batch()
          let ops = 0
          for (const docId of newMatchDocIds) {
            batch.update(db.collection('teeTimes').doc(docId), { notifiedAt: now })
            ops++
            if (ops >= 450) {
              await batch.commit()
              batch = db.batch()
              ops = 0
            }
          }
          if (ops > 0) await batch.commit()
        } catch (err: any) {
          record.errors.push(`Notification failed: ${err?.message}`)
        }
      }

      // Persist check record
      await db.collection('checks').add({
        ...record,
        timestamp: record.timestamp,
      })

      this.status.lastCheck = record.timestamp
      this.status.lastCheckResult = record
    } finally {
      this.isChecking = false
    }

    return record
  }

  private calcNextCheck(intervalMinutes: number): Date {
    const now = new Date()
    const ms = intervalMinutes * 60 * 1000
    return new Date(Math.ceil(now.getTime() / ms) * ms)
  }
}

export const schedulerService = new SchedulerService()

// ─── Reservation reminder helpers ─────────────────────────────────────────────

/**
 * Returns the Monday (week-start) for the week containing `date`.
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Returns the specific dates that fall within a calendar week starting at `weekStart` (Monday).
 */
function getPlayDatesInWeek(weekStart: Date, specificDates: string[]): string[] {
  const wsStr = toDateString(weekStart)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weStr = toDateString(weekEnd)
  return specificDates.filter(d => d >= wsStr && d <= weStr)
}

/**
 * Returns Monday-start dates for the next `n` calendar weeks from today.
 */
function getUpcomingWeekStarts(n: number): Date[] {
  const thisWeek = getWeekStart(new Date())
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(thisWeek)
    d.setDate(d.getDate() + i * 7)
    return d
  })
}

/**
 * Returns week-start strings for weeks that have at least one specific date selected
 * but no reservation on any of those dates.
 */
function findEmptyWeeks(reservations: Reservation[], weekStarts: Date[], specificDates: string[]): string[] {
  const bookedDates = new Set(reservations.map(r => r.date))
  return weekStarts
    .filter(ws => {
      const playDates = getPlayDatesInWeek(ws, specificDates)
      return playDates.length > 0 && !playDates.some(d => bookedDates.has(d))
    })
    .map(ws => toDateString(ws))
}

export interface ReservationFetchResult {
  reservations: Reservation[]
  errors: { source: TeeTimeSource; message: string }[]
}

export async function fetchAllReservations(forceRefresh = false): Promise<ReservationFetchResult> {
  const sources: { source: TeeTimeSource; fetch: () => Promise<Reservation[]> }[] = [
    { source: 'foreup', fetch: () => francisByrneAdapter.fetchReservations(forceRefresh) },
    { source: 'ezlinks', fetch: () => ezLinksAdapter.fetchReservations(forceRefresh) },
  ]
  const settled = await Promise.allSettled(sources.map(s => s.fetch()))
  const reservations: Reservation[] = []
  const errors: { source: TeeTimeSource; message: string }[] = []
  settled.forEach((result, i) => {
    const source = sources[i]!.source
    if (result.status === 'fulfilled') {
      reservations.push(...result.value)
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
      console.warn(`[Reservations] ${source} fetch failed:`, message)
      errors.push({ source, message })
    }
  })
  reservations.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  return { reservations, errors }
}

async function loadPrefs(): Promise<Preferences | null> {
  const prefsDoc = await db.collection('preferences').doc('user').get()
  if (!prefsDoc.exists) return null
  const rawPrefs = prefsDoc.data() as Partial<Preferences>
  return {
    ...DEFAULT_PREFERENCES,
    ...rawPrefs,
    weatherThresholds: {
      ...DEFAULT_PREFERENCES.weatherThresholds,
      ...(rawPrefs.weatherThresholds ?? {}),
    },
  }
}

// ─── Reservation Scheduler ─────────────────────────────────────────────────────

export class ReservationSchedulerService {
  private jobs: cron.ScheduledTask[] = []

  start(): void {
    this.stop()

    // 6am daily: day-of reminder if reservation today
    this.jobs.push(
      cron.schedule('0 6 * * *', () => {
        this.runDayOfReminder().catch(err => console.error('[ReservationScheduler] Day-of reminder failed:', err))
      })
    )

    // 8am Mon (1), Thu (4), Sun (0): weekly digest
    this.jobs.push(
      cron.schedule('0 8 * * 0,1,4', () => {
        this.runWeeklyDigest().catch(err => console.error('[ReservationScheduler] Weekly digest failed:', err))
      })
    )

    // 3am daily: prune teeTimes/teeTimeActive docs older than 7 days
    // and drop past entries from preferences.specificDates
    this.jobs.push(
      cron.schedule('0 3 * * *', () => {
        this.runTeeTimeCleanup().catch(err => console.error('[ReservationScheduler] teeTimes cleanup failed:', err))
        this.prunePastSpecificDates().catch(err => console.error('[ReservationScheduler] specificDates prune failed:', err))
      })
    )

    console.log('[ReservationScheduler] Started (day-of @6am, digest @8am Mon/Thu/Sun, teeTimes + specificDates cleanup @3am)')
  }

  stop(): void {
    for (const job of this.jobs) job.stop()
    this.jobs = []
  }

  async runDayOfReminder(): Promise<void> {
    const prefs = await loadPrefs()
    if (!prefs?.discordWebhookUrl || !prefs.reservationReminders) return

    const todayStr = toDateString(new Date())
    const { reservations } = await fetchAllReservations()
    const todaysReservations = reservations.filter(r => r.date === todayStr)

    for (const r of todaysReservations) {
      await notificationService.sendDayOfReminder(prefs.discordWebhookUrl, r)
      console.log(`[ReservationScheduler] Sent day-of reminder for ${r.date} ${r.time} ${r.scheduleName}`)
    }
  }

  async runTeeTimeCleanup(): Promise<void> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    const cutoffStr = toDateString(cutoff)

    const indexRefs = await db.collection('teeTimeActive').listDocuments()
    let prunedIndexes = 0
    let prunedTimes = 0

    for (const indexRef of indexRefs) {
      const parts = indexRef.id.split('_')
      if (parts.length < 3) continue
      const date = parts[parts.length - 1]
      if (!date || date >= cutoffStr) continue

      const prefix = `${indexRef.id}_`
      const childSnap = await db.collection('teeTimes')
        .where(FieldPath.documentId(), '>=', prefix)
        .where(FieldPath.documentId(), '<', `${prefix}~`)
        .get()

      let batch = db.batch()
      let ops = 0
      for (const doc of childSnap.docs) {
        batch.delete(doc.ref)
        ops++
        prunedTimes++
        if (ops >= 450) {
          await batch.commit()
          batch = db.batch()
          ops = 0
        }
      }
      batch.delete(indexRef)
      ops++
      prunedIndexes++
      await batch.commit()
    }

    console.log(`[ReservationScheduler] teeTimes cleanup: pruned ${prunedIndexes} index docs and ${prunedTimes} time docs older than ${cutoffStr}`)
  }

  async prunePastSpecificDates(): Promise<void> {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const prefsRef = db.collection('preferences').doc('user')
    const snap = await prefsRef.get()
    if (!snap.exists) return
    const data = snap.data() as Partial<Preferences>
    const current = data.specificDates ?? []
    const kept = current.filter(d => d >= todayStr)
    if (kept.length === current.length) return
    await prefsRef.update({ specificDates: kept })
    const removed = current.length - kept.length
    console.log(`[ReservationScheduler] pruned ${removed} past specificDates (cutoff ${todayStr})`)
  }

  async runWeeklyDigest(): Promise<void> {
    const prefs = await loadPrefs()
    if (!prefs?.discordWebhookUrl || !prefs.weeklyDigest) return

    const { reservations } = await fetchAllReservations()
    const weekStarts = getUpcomingWeekStarts(3)
    const emptyWeeks = findEmptyWeeks(reservations, weekStarts, prefs.specificDates || [])

    await notificationService.sendWeeklyDigest(prefs.discordWebhookUrl, reservations, emptyWeeks)
    console.log(`[ReservationScheduler] Sent weekly digest (${reservations.length} reservations, ${emptyWeeks.length} empty weeks)`)
  }
}

export const reservationSchedulerService = new ReservationSchedulerService()
