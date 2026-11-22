import dotenv from "dotenv";
dotenv.config();

import { Events, Collection, TextChannel, PermissionFlagsBits } from "discord.js";
import { createDiscordClient, getAllCommands, registerCommands } from "./client.js";
import { handleInteraction } from "./interactions/dispatcher.js";
import { StorageManager } from "./database/storage.js";
import { ComponentsV2Builder } from "./components-v2/builder.js";
import { EMOJI_STRINGS } from "./constants/emojis.js";

const client = createDiscordClient();
const commands = new Collection<string, any>();

for (const cmd of getAllCommands()) {
  commands.set(cmd.data.name, cmd);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[Sora] Logged in as ${readyClient.user.tag}`);

  // Initialize Supabase PostgreSQL Storage
  try {
    await StorageManager.initialize();
  } catch (err) {
    console.error("[Sora] Failed to initialize Supabase PostgreSQL storage:", err);
  }

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID || readyClient.user.id;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (token && clientId) {
    try {
      await registerCommands(token, clientId, guildId);
    } catch (err) {
      console.error("[Sora] Failed to register slash commands:", err);
    }
  }

  // Periodic Auto-Message Scheduler (every 60 seconds)
  setInterval(async () => {
    for (const [gId, guild] of readyClient.guilds.cache) {
      try {
        const data = StorageManager.getGuildData(gId);
        const now = Date.now();

        for (const msgConfig of data.autoMessages) {
          if (!msgConfig.enabled) continue;

          const lastSent = msgConfig.lastSentAt ? new Date(msgConfig.lastSentAt).getTime() : 0;
          const intervalMs = msgConfig.intervalMinutes * 60 * 1000;

          if (now - lastSent >= intervalMs) {
            const channel = (await guild.channels.fetch(msgConfig.channelId).catch(() => null)) as TextChannel;
            if (channel && channel.isTextBased()) {
              const container = ComponentsV2Builder.container(
                [
                  ComponentsV2Builder.text(
                    `# ${EMOJI_STRINGS.KCS} 서버 정기 안내\n\n${msgConfig.content}`
                  ),
                ],
                0x5865f2
              );
              await channel.send(ComponentsV2Builder.formatMessage(container));
              msgConfig.lastSentAt = new Date().toISOString();
              StorageManager.saveGuildData(data);
            }
          }
        }
      } catch (err) {
        console.error(`[Sora] Auto-message runner error for guild ${gId}:`, err);
      }
    }
  }, 60 * 1000);
});

// Member Join: Auto-roles & Welcome message
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const data = StorageManager.getGuildData(member.guild.id);

    // 1. Auto-roles
    for (const rule of data.autoRoles) {
      const match =
        rule.target === "all" ||
        (rule.target === "human" && !member.user.bot) ||
        (rule.target === "bot" && member.user.bot);

      if (match) {
        await member.roles.add(rule.roleId).catch(() => {});
      }
    }

    // 2. Welcome Message
    if (data.welcome.enabled && data.welcome.channelId) {
      const ch = (await member.guild.channels.fetch(data.welcome.channelId).catch(() => null)) as TextChannel;
      if (ch && ch.isTextBased()) {
        const formatted = data.welcome.messageTemplate
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{server}/g, member.guild.name)
          .replace(/{count}/g, member.guild.memberCount.toString());

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🎉 환영합니다!\n${formatted}`
            ),
          ],
          0x57f287
        );
        await ch.send(ComponentsV2Builder.formatMessage(container));
      }
    }
  } catch (err) {
    console.error("[Sora] Error handling GuildMemberAdd:", err);
  }
});

// Member Leave: Goodbye message
client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const data = StorageManager.getGuildData(member.guild.id);
    if (data.goodbye.enabled && data.goodbye.channelId) {
      const ch = (await member.guild.channels.fetch(data.goodbye.channelId).catch(() => null)) as TextChannel;
      if (ch && ch.isTextBased()) {
        const formatted = data.goodbye.messageTemplate
          .replace(/{user}/g, `**${member.user.username}**`)
          .replace(/{server}/g, member.guild.name)
          .replace(/{count}/g, member.guild.memberCount.toString());

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 👋 잘 가요\n${formatted}`
            ),
          ],
          0x747f8d
        );
        await ch.send(ComponentsV2Builder.formatMessage(container));
      }
    }
  } catch (err) {
    console.error("[Sora] Error handling GuildMemberRemove:", err);
  }
});

// Interaction handling
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;

    const start = Date.now();
    let success = true;

    try {
      await cmd.execute(interaction);
    } catch (err) {
      success = false;
      console.error(`[Sora] Error executing command /${interaction.commandName}:`, err);
    } finally {
      const duration = Date.now() - start;
      StorageManager.recordCommandMetric(interaction.commandName, success, duration);
    }
  } else {
    await handleInteraction(interaction);
  }
});

// Start bot if token present
const token = process.env.DISCORD_TOKEN;
if (token) {
  client.login(token).catch((err) => {
    console.error("[Sora] Failed to login to Discord Gateway:", err);
  });
} else {
  console.log("[Sora] DISCORD_TOKEN is not set in .env. Ready for configuration.");
}
