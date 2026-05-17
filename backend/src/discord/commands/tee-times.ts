import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js'
import { db } from '../../index'
import { weatherService } from '../../services/WeatherService'
import { schedulerService } from '../../services/SchedulerService'
import { DEFAULT_PREFERENCES, ALL_SCHEDULE_NAMES } from '../../constants'
import { resolveWeatherLocationFromTimes } from '../../utils/weatherLocation'
import { readActiveTeeTimes } from '../../utils/teeTimeStore'
import type { Preferences, TeeTime } from '../../types'

export const data = new SlashCommandBuilder()
  .setName('tee-times')
  .setDescription('Show available tee times (cached)')
  .addStringOption(option =>
    option.setName('date')
      .setDescription('Date to search (YYYY-MM-DD, defaults to today)')
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
  const searchDate = dateArg ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
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
    const lines = times.map(t => {
      let line = `${t.time} — ${t.availableSpots} spot${t.availableSpots !== 1 ? 's' : ''}`
      if (t.price != null) line += ` — $${t.price}`
      if (t.weather) {
        const w = t.weather
        const temp = w.temperatureF != null ? `${Math.round(w.temperatureF)}°F` : ''
        const rain = w.precipitationProbabilityPct != null ? `${w.precipitationProbabilityPct}% rain` : ''
        const wind = w.windSpeedMph != null ? `${Math.round(w.windSpeedMph)} mph` : ''
        const parts = [temp, rain, wind].filter(Boolean).join(', ')
        if (parts) line += ` (${parts})`
      }
      return line
    })
    sections.push(`**${course}**\n${lines.join('\n')}`)
  }

  const description = sections.join('\n\n')

  const embed = new EmbedBuilder()
    .setTitle(`Tee Times — ${dateLabel}`)
    .setDescription(description.slice(0, 4000))
    .setColor(0x22c55e)
    .setTimestamp()

  await interaction.editReply({ content: '', embeds: [embed] })
}
