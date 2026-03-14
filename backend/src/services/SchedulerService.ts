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

function isInTimeRange(time: string, start: string, end: string): boolean {
  return time >= start && time <= end
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

      for (const scheduleId of prefs.scheduleIds) {
        record.schedulesChecked.push(scheduleId)
        for (const date of dates) {
          try {
            const times = await francisByrneAdapter.searchTeeTimes([scheduleId], {
              date,
              players: prefs.players,
            })

            const inWindow = times.filter(t =>
              isInTimeRange(t.time, prefs.timeRange.start, prefs.timeRange.end)
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
