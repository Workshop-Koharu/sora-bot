import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";
import { verificationCommand } from "./commands/verification.js";
import { channelCommands } from "./commands/channel.js";
import { serverInfoCommands } from "./commands/server-info.js";
import { moderationCommands } from "./commands/moderation.js";
import { ticketCommand } from "./commands/ticket.js";
import { summaryCommands } from "./commands/summary.js";
import { statsCommand } from "./commands/stats.js";
import { automationCommands } from "./commands/automation.js";
import { helpCommand } from "./commands/help.js";
import { wikiCommands } from "./commands/wiki.js";
import { utilityCommands } from "./commands/utility.js";
import { gamesCommands } from "./commands/games.js";
import { pointsCommands } from "./commands/points.js";

export function createDiscordClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

export function getAllCommands(): any[] {
  return [
    verificationCommand,
    ...channelCommands,
    ...serverInfoCommands,
    ...moderationCommands,
    ticketCommand,
    ...summaryCommands,
    statsCommand,
    ...automationCommands,
    helpCommand,
    ...wikiCommands,
    ...utilityCommands,
    ...gamesCommands,
    ...pointsCommands,
  ];
}

export async function registerCommands(token: string, clientId: string, guildId?: string) {
  const rest = new REST({ version: "10" }).setToken(token);
  const commands = getAllCommands();
  const payload = commands.map((c) => c.data.toJSON());

  console.log(`[Sora] Registering ${payload.length} slash commands...`);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: payload,
    });
    console.log(`[Sora] Successfully registered ${payload.length} guild slash commands to ${guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), {
      body: payload,
    });
    console.log(`[Sora] Successfully registered ${payload.length} global slash commands`);
  }
}
