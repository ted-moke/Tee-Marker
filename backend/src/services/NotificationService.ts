import axios from 'axios'
import { TeeTime } from '../types'
import { FRANCIS_BYRNE_SCHEDULES } from '../constants'

export class NotificationService {
  async sendTeeTimeAlert(webhookUrl: string, times: TeeTime[]): Promise<void> {
    if (!webhookUrl) throw new Error('No Discord webhook URL configured')

    const fields = times.map(t => ({
      name: `${FRANCIS_BYRNE_SCHEDULES[t.scheduleId] || t.scheduleId} — ${t.date}`,
      value: `**${t.time}** · ${t.availableSpots} spot(s)${t.price ? ` · $${t.price.toFixed(2)}` : ''}`,
      inline: false,
    }))

    const embed = {
      title: `⛳ ${times.length} tee time${times.length > 1 ? 's' : ''} available`,
      color: 0x22c55e,
      fields,
      timestamp: new Date().toISOString(),
    }

    await axios.post(webhookUrl, { embeds: [embed] })
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
