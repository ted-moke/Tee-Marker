import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js'
import { db } from '../../index'
import { weatherService } from '../../services/WeatherService'
import { schedulerService } from '../../services/SchedulerService'
import { DEFAULT_PREFERENCES, ALL_SCHEDULE_NAMES, SCHEDULE_SHORT_NAMES } from '../../constants'
import { resolveWeatherLocationFromTimes } from '../../utils/weatherLocation'
import { readActiveTeeTimes } from '../../utils/teeTimeStore'
import type { Preferences, TeeTime } from '../../types'

function formatTimeOfDay(value: string): string {
  const trimmed = value.trim()
  const m12 = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i)
  let hour: number
  let minute: number
  if (m12) {
    const raw = parseInt(m12[1]!, 10)
    minute = parseInt(m12[2]!, 10)
    hour = (raw % 12) + (m12[3]!.toUpperCase() === 'PM' ? 12 : 0)
  } else {
    const m24 = trimmed.match(/(?:^|[ T])(\d{1,2}):(\d{2})(?::\d{2})?\s*$/)
    if (!m24) return value
    hour = parseInt(m24[1]!, 10)
    minute = parseInt(m24[2]!, 10)
  }
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${String(h12).padStart(2, ' ')}:${String(minute).padStart(2, '0')} ${ampm}`
}

export const data = new SlashCommandBuilder()
  .setName('tee-times')
  .setDescription('Show available tee times (cached)')
  .addStringOption(option =>
    option.setName('date')
      .setDescription('Date to search (YYYY-MM-DD); omit for window summary across all monitored dates')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('course')
      .setDescription('Course to search (defaults to all preferred)')
      .setRequired(false)
      .setAutocomplete(true))
  .addBooleanOption(option =>
    option.setName('refresh')
      .setDescription('Run a scheduler check first to refresh cached data')
      .setRequired(false))

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase()
  const choices = Object.entries(ALL_SCHEDULE_NAMES)
    .filter(([, name]) => name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(([id, name]) => ({ name, value: id }))

  await interaction.respond(choices)
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()

  const prefsDoc = await db.collection('preferences').doc('user').get()
  const rawPrefs = prefsDoc.exists ? (prefsDoc.data() as Partial<Preferences>) : {}
  const prefs: Preferences = {
    ...DEFAULT_PREFERENCES,
    ...rawPrefs,
    weatherThresholds: {
      ...DEFAULT_PREFERENCES.weatherThresholds,
      ...(rawPrefs.weatherThresholds ?? {}),
    },
  }

  const dateArg = interaction.options.getString('date')
  if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    await interaction.editReply('Invalid date format. Use YYYY-MM-DD.')
    return
  }

  const courseArg = interaction.options.getString('course')
  const scheduleIds = courseArg ? [courseArg] : prefs.scheduleIds
  const refresh = interaction.options.getBoolean('refresh') ?? false

  if (refresh) {
    await interaction.editReply('Running scheduler check…')
    try {
      await schedulerService.runCheck()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[discord/tee-times] scheduler run failed: ${msg}`)
    }
  }

  if (dateArg) {
    await replyWithDayDetail(interaction, prefs, scheduleIds, dateArg, refresh)
  } else {
    await replyWithWindowSummary(interaction, prefs, scheduleIds)
  }
}

async function replyWithDayDetail(
  interaction: ChatInputCommandInteraction,
  prefs: Preferences,
  scheduleIds: string[],
  searchDate: string,
  refresh: boolean,
): Promise<void> {
  const allTimes = await readActiveTeeTimes(scheduleIds, [searchDate])

  const d = new Date(searchDate + 'T12:00:00')
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'America/New_York' })

  if (allTimes.length === 0) {
    const hint = refresh
      ? ''
      : '\nIf this date is monitored, try `refresh:true`. Otherwise add it to your preferences first.'
    await interaction.editReply(`No cached tee times for ${dateLabel}.${hint}`)
    return
  }

  // Weather enrichment — fill in for any time missing weather (cache only stores
  // it for in-window times; out-of-window times appear unweathered).
  const firstSchedule = scheduleIds[0]
  const location = firstSchedule ? resolveWeatherLocationFromTimes(allTimes, firstSchedule) : null
  if (location) {
    const weatherCache = new Map<string, TeeTime['weather'] | null>()
    for (const t of allTimes) {
      if (t.weather) continue
      if (weatherCache.has(t.time)) {
        const cached = weatherCache.get(t.time)
        if (cached) t.weather = cached
        continue
      }
      try {
        const w = await weatherService.getWeatherForTeeTime(location, searchDate, t.time, prefs.forecastOffsetHours)
        weatherCache.set(t.time, w)
        if (w) t.weather = w
      } catch {
        weatherCache.set(t.time, null)
      }
    }
  }

  const byCourse = new Map<string, TeeTime[]>()
  for (const t of allTimes) {
    const name = t.scheduleName ?? ALL_SCHEDULE_NAMES[t.scheduleId] ?? t.scheduleId
    const list = byCourse.get(name) ?? []
    list.push(t)
    byCourse.set(name, list)
  }

  const sections: string[] = []
  for (const [course, times] of byCourse) {
    const sorted = [...times].sort((a, b) => a.time.localeCompare(b.time))
    const rows = sorted.map(t => {
      const time = formatTimeOfDay(t.time)
      const spots = `${t.availableSpots}p`
      const price = t.price != null ? `$${Math.round(t.price)}` : ''
      const w = t.weather
      const temp = w?.temperatureF != null ? `${Math.round(w.temperatureF)}°F` : ''
      const rain = w?.precipitationProbabilityPct != null ? `${w.precipitationProbabilityPct}%r` : ''
      const wind = w?.windSpeedMph != null ? `${Math.round(w.windSpeedMph)}mph` : ''
      return { time, spots, price, temp, rain, wind }
    })
    const widths = {
      time: Math.max(...rows.map(r => r.time.length)),
      spots: Math.max(...rows.map(r => r.spots.length)),
      price: Math.max(...rows.map(r => r.price.length)),
      temp: Math.max(...rows.map(r => r.temp.length)),
      rain: Math.max(...rows.map(r => r.rain.length)),
      wind: Math.max(...rows.map(r => r.wind.length)),
    }
    const lines = rows.map(r => {
      const cols = [
        r.time.padStart(widths.time),
        r.spots.padStart(widths.spots),
        r.price.padStart(widths.price),
        r.temp.padStart(widths.temp),
        r.rain.padStart(widths.rain),
        r.wind.padStart(widths.wind),
      ].filter((_, i) => {
        const widthVals = [widths.time, widths.spots, widths.price, widths.temp, widths.rain, widths.wind]
        return widthVals[i]! > 0
      })
      return cols.join('  ')
    })
    sections.push(`**${course}**\n\`\`\`\n${lines.join('\n')}\n\`\`\``)
  }

  const description = sections.join('\n\n')

  const embed = new EmbedBuilder()
    .setTitle(`Tee Times — ${dateLabel}`)
    .setDescription(description.slice(0, 4000))
    .setColor(0x22c55e)
    .setTimestamp()

  await interaction.editReply({ content: '', embeds: [embed] })
}

async function replyWithWindowSummary(
  interaction: ChatInputCommandInteraction,
  prefs: Preferences,
  scheduleIds: string[],
): Promise<void> {
  const dates = [...prefs.specificDates].sort()
  if (dates.length === 0) {
    await interaction.editReply('No dates configured in preferences. Use `/tee-times date:YYYY-MM-DD` or add monitored dates in Preferences.')
    return
  }

  const allTimes = await readActiveTeeTimes(scheduleIds, dates)

  const earliestByDateSchedule = new Map<string, Map<string, string>>()
  for (const t of allTimes) {
    let courseMap = earliestByDateSchedule.get(t.date)
    if (!courseMap) {
      courseMap = new Map()
      earliestByDateSchedule.set(t.date, courseMap)
    }
    const existing = courseMap.get(t.scheduleId)
    if (!existing || t.time < existing) {
      courseMap.set(t.scheduleId, t.time)
    }
  }

  const dateLabels = new Map<string, string>(
    dates.map(date => {
      const d = new Date(date + 'T12:00:00')
      return [date, d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'America/New_York' })]
    })
  )
  const dateLabelWidth = Math.max(...[...dateLabels.values()].map(l => l.length))
  const shortNames = new Map<string, string>(
    scheduleIds.map(id => [id, SCHEDULE_SHORT_NAMES[id] ?? ALL_SCHEDULE_NAMES[id] ?? id])
  )
  const shortNameWidth = Math.max(...[...shortNames.values()].map(n => n.length))
  const TIME_PLACEHOLDER = '   —    '

  const lines = dates.map(date => {
    const dateLabel = dateLabels.get(date)!.padEnd(dateLabelWidth)
    const courseMap = earliestByDateSchedule.get(date)
    const cols = scheduleIds.map(id => {
      const short = shortNames.get(id)!.padEnd(shortNameWidth)
      const earliest = courseMap?.get(id)
      const timeStr = earliest ? formatTimeOfDay(earliest) : TIME_PLACEHOLDER
      return `${short} ${timeStr}`
    })
    return `${dateLabel}  ${cols.join('  ')}`
  })

  const embed = new EmbedBuilder()
    .setTitle('Tee Times — Window Summary')
    .setDescription('```\n' + lines.join('\n').slice(0, 3900) + '\n```')
    .setColor(0x22c55e)
    .setTimestamp()

  await interaction.editReply({ content: '', embeds: [embed] })
}
