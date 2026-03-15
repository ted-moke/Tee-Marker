import axios from 'axios'
import { TeeTime } from '../types'
import { FRANCIS_BYRNE_SCHEDULES } from '../constants'

const DISCORD_DESCRIPTION_LIMIT = 4000

export class NotificationService {
  async sendTeeTimeAlert(webhookUrl: string, times: TeeTime[]): Promise<void> {
    if (!webhookUrl) throw new Error('No Discord webhook URL configured')
    if (times.length === 0) return

    const grouped = new Map<string, TeeTime[]>()
    for (const t of times) {
      const course = FRANCIS_BYRNE_SCHEDULES[t.scheduleId] || t.scheduleId
      const key = `${course} — ${t.date}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(t)
    }

    const sortedGroups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    const lines: string[] = []
    let included = 0
    let truncated = false

    for (const [group, groupTimes] of sortedGroups) {
      const sortedTimes = [...groupTimes].sort((a, b) => a.time.localeCompare(b.time))
      const timeText = this.summarizeTimes(sortedTimes)
      const line = `• ${group}: ${timeText}`

      const next = lines.length === 0 ? line : `${lines.join('\n')}\n${line}`
      if (next.length > DISCORD_DESCRIPTION_LIMIT) {
        truncated = true
        break
      }
      lines.push(line)
      included += sortedTimes.length
    }

    const remaining = times.length - included
    if (truncated && remaining > 0) {
      const extra = `\n…and ${remaining} more tee time${remaining > 1 ? 's' : ''}.`
      const current = lines.join('\n')
      if ((current + extra).length <= DISCORD_DESCRIPTION_LIMIT) {
        lines.push(`…and ${remaining} more tee time${remaining > 1 ? 's' : ''}.`)
      }
    }

    const embed = {
      title: `⛳ ${times.length} tee time${times.length > 1 ? 's' : ''} available`,
      color: 0x22c55e,
      description: lines.join('\n'),
      timestamp: new Date().toISOString(),
    }

    await axios.post(webhookUrl, { embeds: [embed] })
  }

  private formatTime(value: string): string {
    const trimmed = value.trim()
    const timePart = trimmed.split(/[ T]/).pop()?.trim() || trimmed
    return timePart
  }

  private summarizeTimes(times: TeeTime[]): string {
    const formatted = times.map(t => this.formatTime(t.time))
    if (formatted.length <= 2) {
      return formatted.join(', ')
    }

    const preview = formatted.slice(0, 2).join(', ')
    const remaining = formatted.length - 2
    return `${preview}, and ${remaining} more`
  }

  async testWebhook(webhookUrl: string): Promise<boolean> {
    try {
      await axios.post(webhookUrl, {
        embeds: [{
          title: '⛳ Tee Marker — test notification',
          description: 'Your webhook is working correctly.',
          color: 0x3b82f6,
          timestamp: new Date().toISOString(),
        }]
      })
      return true
    } catch {
      return false
    }
  }
}

export const notificationService = new NotificationService()
