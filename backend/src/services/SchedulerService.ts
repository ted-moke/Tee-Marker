import * as cron from 'node-cron'
import { db } from '../index'
import { francisByrneAdapter } from '../adapters/FrancisByrneAdapter'
import { notificationService } from './NotificationService'
import { weatherService } from './WeatherService'
import { COURSE_LOCATION_BY_SCHEDULE, DEFAULT_PREFERENCES } from '../constants'
import { Preferences, CheckRecord, SchedulerStatus, TeeTime, Reservation } from '../types'
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

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
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
  const v = trimmed.split(/[ T]/).pop()?.trim() || trimmed
  const m12 = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (m12) {
    const rawHourStr = m12[1]
    const minuteStr = m12[2]
    const suffixRaw = m12[3]
    if (!rawHourStr || !minuteStr || !suffixRaw) return null
    const rawHour = parseInt(rawHourStr, 10)
    const minute = parseInt(minuteStr, 10)
    const suffix = suffixRaw.toUpperCase()
    if (Number.isNaN(rawHour) || Number.isNaN(minute) || minute < 0 || minute > 59 || rawHour < 1 || rawHour > 12) {
      return null
    }
    const hour24 = (rawHour % 12) + (suffix === 'PM' ? 12 : 0)
    return hour24 * 60 + minute
  }

  const m24 = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (m24) {
    const hourStr = m24[1]
    const minuteStr = m24[2]
    if (!hourStr || !minuteStr) return null
    const hour = parseInt(hourStr, 10)
    const minute = parseInt(minuteStr, 10)
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

    const weatherByTime = new Map<string, TeeTime['weather'] | null>()
    return Promise.all(
      times.map(async (teeTime): Promise<TeeTime> => {
        if (weatherByTime.has(teeTime.time)) {
          const cached = weatherByTime.get(teeTime.time)
          return cached ? { ...teeTime, weather: cached } : teeTime
        }

        try {
          const weather = await weatherService.getWeatherForTeeTime(location, date, teeTime.time, forecastOffsetHours)
          weatherByTime.set(teeTime.time, weather)
          return weather ? { ...teeTime, weather } : teeTime
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          console.warn(`[Scheduler] Weather enrichment failed schedule=${scheduleId} date=${date}: ${message}`)
          weatherByTime.set(teeTime.time, null)
          return teeTime
        }
      })
    )
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
        const times = await francisByrneAdapter.searchTeeTimes([scheduleId], {
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

    const dates: string[] = []
    const today = new Date()
    for (let i = 0; i <= (prefs.lookAheadDays || 7); i++) {
      const d = addDays(today, i)
      if (prefs.daysOfWeek.includes(d.getDay())) {
        dates.push(toDateString(d))
      }
    }

    const matchingTimes: TeeTime[] = []
    for (const scheduleId of prefs.scheduleIds) {
      for (const date of dates) {
        try {
          const times = await francisByrneAdapter.searchTeeTimes([scheduleId], {
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

      // Build date list: today + lookAheadDays, filtered to configured daysOfWeek
      const dates: string[] = []
      const today = new Date()
      for (let i = 0; i <= (prefs.lookAheadDays || 7); i++) {
        const d = addDays(today, i)
        if (prefs.daysOfWeek.includes(d.getDay())) {
          dates.push(toDateString(d))
        }
      }

      const newMatches: TeeTime[] = []
      const searchedTimes: TeeTime[] = []
      console.log(
        `[Scheduler] Starting check for schedules=${prefs.scheduleIds.join(',')} dates=${dates.join(',')} window=${prefs.timeRange.start}-${prefs.timeRange.end} players>=${prefs.players}`
      )

      record.schedulesChecked.push(...prefs.scheduleIds)
      for (const scheduleId of prefs.scheduleIds) {
        for (const date of dates) {
          try {
            // Query one schedule at a time so ForeUp uses the right primary schedule_id context.
            const times = await francisByrneAdapter.searchTeeTimes([scheduleId], {
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
            console.log(
              `[Scheduler] schedule=${scheduleId} date=${date} returned=${times.length} inWindow=${inWindowWithWeather.length} sampleTimes=${times.slice(0, 5).map(t => t.time).join(',') || 'none'}`
            )

            record.timesFound += inWindowWithWeather.length

            for (const t of inWindowWithWeather) {
              const dedupId = `${t.scheduleId}_${t.date}_${t.time}`
              const existing = await db.collection('notifiedTimes').doc(dedupId).get()
              if (!existing.exists) {
                newMatches.push(t)
              }
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

          // Write dedup records
          const batch = db.batch()
          for (const t of newMatches) {
            const dedupId = `${t.scheduleId}_${t.date}_${t.time}`
            batch.set(db.collection('notifiedTimes').doc(dedupId), {
              scheduleId: t.scheduleId,
              date: t.date,
              time: t.time,
              notifiedAt: new Date(),
            })
          }
          await batch.commit()
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
 * Returns the ISO dates (YYYY-MM-DD) for all configured play days within a
 * calendar week starting at `weekStart` (Monday), given `daysOfWeek`.
 */
function getPlayDatesInWeek(weekStart: Date, daysOfWeek: number[]): string[] {
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    if (daysOfWeek.includes(d.getDay())) {
      dates.push(toDateString(d))
    }
  }
  return dates
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
 * Returns week-start strings for weeks that have no reservation on any
 * configured play day.
 */
function findEmptyWeeks(reservations: Reservation[], weekStarts: Date[], daysOfWeek: number[]): string[] {
  const bookedDates = new Set(reservations.map(r => r.date))
  return weekStarts
    .filter(ws => {
      const playDates = getPlayDatesInWeek(ws, daysOfWeek)
      return playDates.length > 0 && !playDates.some(d => bookedDates.has(d))
    })
    .map(ws => toDateString(ws))
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

    // 8am Mon (1), Thu (4), Sun (0): empty-week alert
    this.jobs.push(
      cron.schedule('0 8 * * 0,1,4', () => {
        this.runEmptyWeekAlert().catch(err => console.error('[ReservationScheduler] Empty-week alert failed:', err))
      })
    )

    // 9am Monday: weekly digest
    this.jobs.push(
      cron.schedule('0 9 * * 1', () => {
        this.runWeeklyDigest().catch(err => console.error('[ReservationScheduler] Weekly digest failed:', err))
      })
    )

    console.log('[ReservationScheduler] Started (day-of @6am, empty-week @8am Mon/Thu/Sun, digest @9am Mon)')
  }

  stop(): void {
    for (const job of this.jobs) job.stop()
    this.jobs = []
  }

  async runDayOfReminder(): Promise<void> {
    const prefs = await loadPrefs()
    if (!prefs?.discordWebhookUrl || !prefs.reservationReminders) return

    const todayStr = toDateString(new Date())
    const reservations = await francisByrneAdapter.fetchReservations()
    const todaysReservations = reservations.filter(r => r.date === todayStr)

    for (const r of todaysReservations) {
      await notificationService.sendDayOfReminder(prefs.discordWebhookUrl, r)
      console.log(`[ReservationScheduler] Sent day-of reminder for ${r.date} ${r.time} ${r.scheduleName}`)
    }
  }

  async runEmptyWeekAlert(): Promise<void> {
    const prefs = await loadPrefs()
    if (!prefs?.discordWebhookUrl || !prefs.emptyWeekAlerts) return

    const reservations = await francisByrneAdapter.fetchReservations()
    const weekStarts = getUpcomingWeekStarts(3)
    const emptyWeeks = findEmptyWeeks(reservations, weekStarts, prefs.daysOfWeek)

    if (emptyWeeks.length > 0) {
      await notificationService.sendEmptyWeekAlert(prefs.discordWebhookUrl, emptyWeeks)
      console.log(`[ReservationScheduler] Sent empty-week alert for weeks: ${emptyWeeks.join(', ')}`)
    }
  }

  async runWeeklyDigest(): Promise<void> {
    const prefs = await loadPrefs()
    if (!prefs?.discordWebhookUrl || !prefs.weeklyDigest) return

    const reservations = await francisByrneAdapter.fetchReservations()
    const weekStarts = getUpcomingWeekStarts(3)
    const emptyWeeks = findEmptyWeeks(reservations, weekStarts, prefs.daysOfWeek)

    await notificationService.sendWeeklyDigest(prefs.discordWebhookUrl, reservations, emptyWeeks)
    console.log(`[ReservationScheduler] Sent weekly digest (${reservations.length} reservations, ${emptyWeeks.length} empty weeks)`)
  }
}

export const reservationSchedulerService = new ReservationSchedulerService()
