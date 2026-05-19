import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { fetchAllReservations } from '../../services/SchedulerService'

export const data = new SlashCommandBuilder()
  .setName('reservations')
  .setDescription('Show your upcoming golf reservations')

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()

  const { reservations, errors } = await fetchAllReservations()

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = reservations.filter(r => r.date >= today && r.status !== 'cancelled')

  const lines = upcoming.map(r => {
    const d = new Date(r.date + 'T12:00:00')
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'America/New_York' })
    return `**${dayLabel}** ${r.time} — ${r.scheduleName} (${r.players} player${r.players !== 1 ? 's' : ''})`
  })

  const footerParts = errors.map(e => `⚠️ ${e.source} failed: ${e.message}`)
  if (errors.length === 0 && upcoming.length === 0) {
    footerParts.push('No upcoming reservations on either source.')
  }

  const description = lines.length > 0 ? lines.join('\n') : '_No upcoming reservations._'
  const color = errors.length > 0 ? 0xeab308 : 0x22c55e

  const embed = new EmbedBuilder()
    .setTitle('Upcoming Reservations')
    .setDescription(description)
    .setColor(color)
    .setTimestamp()

  if (footerParts.length > 0) {
    embed.setFooter({ text: footerParts.join(' • ').slice(0, 2048) })
  }

  await interaction.editReply({ embeds: [embed] })
}
