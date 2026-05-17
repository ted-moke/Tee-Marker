import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { db } from '../../index'
import { DEFAULT_PREFERENCES, ALL_SCHEDULE_NAMES } from '../../constants'
import type { Preferences } from '../../types'

export const data = new SlashCommandBuilder()
  .setName('preferences')
  .setDescription('Show your current monitoring preferences')

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
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

  const courses = prefs.scheduleIds
    .map(id => ALL_SCHEDULE_NAMES[id] ?? id)
    .join(', ')

  const dates = prefs.specificDates.length > 0
    ? prefs.specificDates.join(', ')
    : 'None'

  const wt = prefs.weatherThresholds

  const embed = new EmbedBuilder()
    .setTitle('Monitoring Preferences')
    .setColor(0x3b82f6)
    .addFields(
      { name: 'Courses', value: courses, inline: false },
      { name: 'Time Range', value: `${prefs.timeRange.start} – ${prefs.timeRange.end}`, inline: true },
      { name: 'Players', value: String(prefs.players), inline: true },
      { name: 'Check Interval', value: `${prefs.checkIntervalMinutes} min`, inline: true },
      { name: 'Specific Dates', value: dates, inline: false },
      { name: 'Weather Thresholds', value: `Rain: ${wt.rainGoodMax}–${wt.rainBadMin}% | Wind: ${wt.windGoodMax}–${wt.windMidMax} mph | Temp: ${wt.tempBadLow}–${wt.tempBadHigh}°F`, inline: false },
    )
    .setTimestamp()

  await interaction.reply({ embeds: [embed] })
}
