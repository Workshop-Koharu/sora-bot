import {
  ChannelType,
  Guild,
  PermissionFlagsBits,
  TextChannel,
  User,
} from "discord.js";
import { StorageManager } from "../database/storage.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { TicketSession } from "../types/index.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export class TicketService {
  /**
   * Create a new ticket channel for a member
   */
  public static async createTicket(
    guild: Guild,
    user: User,
    categoryId: string
  ): Promise<{ channel: TextChannel; session: TicketSession }> {
    const data = StorageManager.getGuildData(guild.id);
    const catConfig = data.tickets.categories.find((c) => c.id === categoryId) || {
      id: "general",
      label: "일반 문의",
      description: "문의",
    };

    const channelName = `ticket-${user.username.slice(0, 8)}-${Date.now().toString().slice(-4)}`;

    const permissionOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: guild.client.user!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    if (data.tickets.supportRoleId) {
      permissionOverwrites.push({
        id: data.tickets.supportRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      });
    }

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: data.tickets.categoryId || undefined,
      permissionOverwrites,
    });

    const session: TicketSession = {
      id: `tkt_${Date.now()}`,
      guildId: guild.id,
      channelId: channel.id,
      userId: user.id,
      category: catConfig.label,
      status: "open",
      createdAt: new Date().toISOString(),
    };

    data.ticketSessions.push(session);
    StorageManager.saveGuildData(data);

    // Send Components V2 Controls inside the ticket channel
    const ticketEmbed = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.SORA} ${catConfig.label} 티켓\n**문의자:** <@${user.id}>\n\n문의 내용을 상세히 작성해 주시면 담당자가 빠르게 확인 후 답변드리겠습니다.`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.emojiButton("CHECK", `ticket_claim_${session.id}`),
          ComponentsV2Builder.emojiButton("TRASH", `ticket_close_${session.id}`),
          ComponentsV2Builder.emojiButton("SHARE", `ticket_transcript_${session.id}`)
        ),
      ],
      0x5865f2
    );

    await channel.send(ComponentsV2Builder.formatMessage(ticketEmbed));

    return { channel, session };
  }
}
