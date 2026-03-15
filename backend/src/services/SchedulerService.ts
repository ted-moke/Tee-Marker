import * as cron from 'node-cron'
import { db } from '../index'
import { francisByrneAdapter } from '../adapters/FrancisByrneAdapter'
import { notificationService } from './NotificationService'
import { Preferences, CheckRecord, SchedulerStatus, TeeTime } from '../types'

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]!
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

      const prefs = prefsDoc.data() as Preferences

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

            const inWindow = times.filter(t =>
              isInTimeRange(t.time, prefs.timeRange.start, prefs.timeRange.end)
            )
            console.log(
              `[Scheduler] schedule=${scheduleId} date=${date} returned=${times.length} inWindow=${inWindow.length} sampleTimes=${times.slice(0, 5).map(t => t.time).join(',') || 'none'}`
            )

            record.timesFound += inWindow.length

            for (const t of inWindow) {
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

      if (newMatches.length > 0 && prefs.discordWebhookUrl) {
        try {
          await notificationService.sendTeeTimeAlert(prefs.discordWebhookUrl, newMatches)
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
