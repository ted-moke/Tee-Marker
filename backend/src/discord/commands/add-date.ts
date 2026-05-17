import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { db } from '../../index'
import { DEFAULT_PREFERENCES } from '../../constants'
import type { Preferences } from '../../types'

export const data = new SlashCommandBuilder()
  .setName('add-date')
  .setDescription('Add a date to monitor for tee times')
  .addStringOption(option =>
    option.setName('date')
      .setDescription('Date to add (YYYY-MM-DD)')
      .setRequired(true))

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const date = interaction.options.getString('date', true)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    await interaction.reply({ content: 'Invalid format. Use YYYY-MM-DD.', ephemeral: true })
    return
  }

  const parsed = new Date(date + 'T12:00:00')
  if (isNaN(parsed.getTime())) {
    await interaction.reply({ content: 'Invalid date.', ephemeral: true })
    return
  }

  const today = new Date().toISOString().slice(0, 10)
  if (date < today) {
    await interaction.reply({ content: 'Cannot add a past date.', ephemeral: true })
    return
  }

  const prefsDoc = await db.collection('preferences').doc('user').get()
  const rawPrefs = prefsDoc.exists ? (prefsDoc.data() as Partial<Preferences>) : {}
  const specificDates = [...(rawPrefs.specificDates ?? DEFAULT_PREFERENCES.specificDates)]

  if (specificDates.includes(date)) {
    await interaction.reply({ content: `${date} is already in your date list.`, ephemeral: true })
    return
  }

  specificDates.push(date)
  specificDates.sort()

  await db.collection('preferences').doc('user').set({ specificDates }, { merge: true })

  await interaction.reply(`Added **${date}**. Monitoring dates: ${specificDates.join(', ')}`)
}
