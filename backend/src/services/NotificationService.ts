import axios from 'axios'
import { DailyWeatherSummaryDay, TeeTime, WeatherThresholds } from '../types'
import { FRANCIS_BYRNE_SCHEDULES } from '../constants'

const DISCORD_DESCRIPTION_LIMIT = 4000

export class NotificationService {
  async sendTeeTimeAlert(webhookUrl: string, times: TeeTime[], thresholds?: WeatherThresholds): Promise<void> {
    if (!webhookUrl) throw new Error('No Discord webhook URL configured')
    if (times.length === 0) return

    const grouped = new Map<string, TeeTime[]>()
    for (const t of times) {
      const course = FRANCIS_BYRNE_SCHEDULES[t.scheduleId] || t.scheduleId
      const dateLabel = this.formatRelativeDayLabel(t.date)
      const key = `${course} — ${dateLabel}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(t)
    }

    const sortedGroups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    const lines: string[] = []
    let included = 0
    let truncated = false

    for (const [group, groupTimes] of sortedGroups) {
      const sortedTimes = [...groupTimes].sort((a, b) => a.time.localeCompare(b.time))
      const timeText = this.summarizeTimes(sortedTimes, thresholds)
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

  async sendDailyWeatherSummary(
    webhookUrl: string,
    days: DailyWeatherSummaryDay[],
    thresholds?: WeatherThresholds
  ): Promise<void> {
    if (!webhookUrl) throw new Error('No Discord webhook URL configured')
    if (days.length === 0) return

    const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))
    const lines = sortedDays.map(day => this.formatDailyWeatherLine(day, thresholds))

    const embed = {
      title: '🌤️ Daily 14-Day Weather Outlook',
      color: 0x3b82f6,
      description: lines.join('\n'),
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Legend: Rain / Wind / Temp circles',
      },
    }

    await axios.post(webhookUrl, { embeds: [embed] })
  }

  private formatRelativeDayLabel(isoDate: string): string {
    const target = new Date(`${isoDate}T00:00:00`)
    const today = new Date()
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dayMs = 24 * 60 * 60 * 1000
    const diffDays = Math.round((target.getTime() - base.getTime()) / dayMs)
    const weekday = target.toLocaleDateString('en-US', { weekday: 'long' })
    const weeksAhead = Math.floor(diffDays / 7)

    let label = weekday
    if (weeksAhead === 1) label = `Next ${weekday}`
    else if (weeksAhead >= 2) label = `In ${weeksAhead} weeks • ${weekday}`

    const shortDate = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${label} (${shortDate})`
  }

  private formatTime(value: string): string {
    const trimmed = value.trim()
    const timePart = trimmed.split(/[ T]/).pop()?.trim() || trimmed
    return timePart
  }

  private formatDailyWeatherLine(day: DailyWeatherSummaryDay, thresholds?: WeatherThresholds): string {
    const label = this.formatRelativeDayLabel(day.date)
    if (!day.weather) {
      return `• ${label}: ⚪ Rain -- | ⚪ Temp -- (Wind -- mph)`
    }

    const rainValue = day.weather.precipitationProbabilityPct
    const windValue = day.weather.windSpeedMph
    const tempValue = day.weather.temperatureF

    const rainText = rainValue === null ? '--' : `${Math.round(rainValue)}%`
    const windText = windValue === null ? '--' : `${Math.round(windValue)}mph`
    const tempText = tempValue === null ? '--' : `${Math.round(tempValue)}F`

    const rainCircle = this.rainCircle(rainValue, thresholds)
    const windCircle = this.windCircle(windValue, thresholds)
    const tempCircle = this.tempCircle(tempValue, thresholds)

    return `• ${label}: ${rainCircle} Rain ${rainText} | ${tempCircle} Temp ${tempText} | ${windCircle} Wind ${windText} mph`
  }

  private summarizeTimes(times: TeeTime[], thresholds?: WeatherThresholds): string {
    const formatted = times.map(t => this.formatTeeTimeWithWeather(t, thresholds))
    if (formatted.length <= 2) {
      return formatted.join(', ')
    }

    const preview = formatted.slice(0, 2).join(', ')
    const remaining = formatted.length - 2
    return `${preview}, and ${remaining} more`
  }

  private formatTeeTimeWithWeather(time: TeeTime, thresholds?: WeatherThresholds): string {
    const base = this.formatTime(time.time)
    if (!time.weather) {
      return base
    }

    const weatherParts: string[] = []
    if (time.weather.precipitationProbabilityPct !== null) {
      const rain = Math.round(time.weather.precipitationProbabilityPct)
      weatherParts.push(`${this.rainEmoji(rain, thresholds)} ${rain}%`)
    }
    if (time.weather.windSpeedMph !== null) {
      const wind = Math.round(time.weather.windSpeedMph)
      weatherParts.push(`${this.windEmoji(wind, thresholds)} ${wind}mph`)
    }
    if (time.weather.temperatureF !== null) {
      const temp = Math.round(time.weather.temperatureF)
      weatherParts.push(`${this.tempEmoji(temp, thresholds)} ${temp}F`)
    }

    if (weatherParts.length === 0) {
      return base
    }
    return `${base} (${weatherParts.join(' ')})`
  }

  private rainEmoji(value: number, thresholds?: WeatherThresholds): string {
    if (!thresholds) return '🌧️'
    if (value < thresholds.rainGoodMax) return '🟢'
    if (value > thresholds.rainBadMin) return '🔴'
    return '🟡'
  }

  private rainCircle(value: number | null, thresholds?: WeatherThresholds): string {
    if (value === null) return '⚪'
    if (!thresholds) return '⚪'
    if (value < thresholds.rainGoodMax) return '🟢'
    if (value > thresholds.rainBadMin) return '🔴'
    return '🟡'
  }

  private windEmoji(value: number, thresholds?: WeatherThresholds): string {
    if (!thresholds) return '💨'
    if (value < thresholds.windGoodMax) return '🟢'
    if (value <= thresholds.windMidMax) return '🟡'
    return '🔴'
  }

  private windCircle(value: number | null, thresholds?: WeatherThresholds): string {
    if (value === null) return '⚪'
    if (!thresholds) return '⚪'
    if (value < thresholds.windGoodMax) return '🟢'
    if (value <= thresholds.windMidMax) return '🟡'
    return '🔴'
  }

  private tempEmoji(value: number, thresholds?: WeatherThresholds): string {
    if (!thresholds) return '🌡️'
    if (value < thresholds.tempBadLow || value > thresholds.tempBadHigh) return '🔴'
    if (value >= thresholds.tempGoodMin && value <= thresholds.tempGoodMax) return '🟢'
    return '🟡'
  }

  private tempCircle(value: number | null, thresholds?: WeatherThresholds): string {
    if (value === null) return '⚪'
    if (!thresholds) return '⚪'
    if (value < thresholds.tempBadLow || value > thresholds.tempBadHigh) return '🔴'
    if (value >= thresholds.tempGoodMin && value <= thresholds.tempGoodMax) return '🟢'
    return '🟡'
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
