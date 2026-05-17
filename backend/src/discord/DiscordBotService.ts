import { Client, GatewayIntentBits, REST, Routes, ChatInputCommandInteraction, AutocompleteInteraction, SharedSlashCommand } from 'discord.js'

import * as reservationsCmd from './commands/reservations'
import * as preferencesCmd from './commands/preferences'
import * as addDateCmd from './commands/add-date'
import * as removeDateCmd from './commands/remove-date'
import * as teeTimesCmd from './commands/tee-times'

interface Command {
  data: SharedSlashCommand
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>
}

const commands: Command[] = [
  reservationsCmd,
  preferencesCmd,
  addDateCmd,
  removeDateCmd,
  teeTimesCmd,
]

class DiscordBotService {
  private client: Client | null = null

  async start(): Promise<void> {
    const token = process.env['DISCORD_BOT_TOKEN']
    const clientId = process.env['DISCORD_CLIENT_ID']
    if (!token || !clientId) {
      console.warn('[DiscordBot] DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID not set, skipping')
      return
    }

    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(token)
    const commandData = commands.map(c => c.data.toJSON())

    const guildId = process.env['DISCORD_GUILD_ID']
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData })
      console.log(`[DiscordBot] Registered ${commands.length} guild commands`)
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commandData })
      console.log(`[DiscordBot] Registered ${commands.length} global commands (may take up to 1hr to propagate)`)
    }

    // Create client and listen for interactions
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] })

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand()) {
        const cmd = commands.find(c => c.data.name === interaction.commandName)
        if (!cmd) return
        try {
          await cmd.execute(interaction)
        } catch (err) {
          console.error(`[DiscordBot] Error in /${interaction.commandName}:`, err)
          const reply = { content: 'Something went wrong.', ephemeral: true as const }
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply(reply).catch(() => {})
          } else {
            await interaction.reply(reply).catch(() => {})
          }
        }
      } else if (interaction.isAutocomplete()) {
        const cmd = commands.find(c => c.data.name === interaction.commandName)
        if (cmd?.autocomplete) {
          try {
            await cmd.autocomplete(interaction)
          } catch (err) {
            console.error(`[DiscordBot] Autocomplete error in /${interaction.commandName}:`, err)
          }
        }
      }
    })

    this.client.once('ready', (c) => {
      console.log(`[DiscordBot] Logged in as ${c.user.tag}`)
    })

    await this.client.login(token)
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.destroy()
      this.client = null
    }
  }
}

export const discordBotService = new DiscordBotService()
