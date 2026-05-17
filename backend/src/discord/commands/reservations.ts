import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { fetchAllReservations } from '../../services/SchedulerService'

export const data = new SlashCommandBuilder()
  .setName('reservations')
  .setDescription('Show your upcoming golf reservations')

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()

  const reservations = await fetchAllReservations()

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = reservations.filter(r => r.date >= today && r.status !== 'cancelled')

  if (upcoming.length === 0) {
    await interaction.editReply('No upcoming reservations.')
    return
  }

  const lines = upcoming.map(r => {
    const d = new Date(r.date + 'T12:00:00')
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'America/New_York' })
    return `**${dayLabel}** ${r.time} — ${r.scheduleName} (${r.players} player${r.players !== 1 ? 's' : ''})`
  })

  const embed = new EmbedBuilder()
    .setTitle('Upcoming Reservations')
    .setDescription(lines.join('\n'))
    .setColor(0x22c55e)
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}
