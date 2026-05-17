import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js'
import { db } from '../../index'
import { DEFAULT_PREFERENCES } from '../../constants'
import type { Preferences } from '../../types'

export const data = new SlashCommandBuilder()
  .setName('remove-date')
  .setDescription('Remove a date from monitoring')
  .addStringOption(option =>
    option.setName('date')
      .setDescription('Date to remove (YYYY-MM-DD)')
      .setRequired(true)
      .setAutocomplete(true))

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused()
  const prefsDoc = await db.collection('preferences').doc('user').get()
  const rawPrefs = prefsDoc.exists ? (prefsDoc.data() as Partial<Preferences>) : {}
  const dates = rawPrefs.specificDates ?? DEFAULT_PREFERENCES.specificDates

  const filtered = dates
    .filter(d => d.includes(focused))
    .slice(0, 25)

  await interaction.respond(filtered.map(d => ({ name: d, value: d })))
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const date = interaction.options.getString('date', true)

  const prefsDoc = await db.collection('preferences').doc('user').get()
  const rawPrefs = prefsDoc.exists ? (prefsDoc.data() as Partial<Preferences>) : {}
  const specificDates = [...(rawPrefs.specificDates ?? DEFAULT_PREFERENCES.specificDates)]

  const idx = specificDates.indexOf(date)
  if (idx === -1) {
    await interaction.reply({ content: `${date} is not in your date list.`, ephemeral: true })
    return
  }

  specificDates.splice(idx, 1)

  await db.collection('preferences').doc('user').set({ specificDates }, { merge: true })

  const remaining = specificDates.length > 0 ? specificDates.join(', ') : 'None'
  await interaction.reply(`Removed **${date}**. Monitoring dates: ${remaining}`)
}
