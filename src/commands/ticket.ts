import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName("문의구성")
    .setDescription("초고도화 커스텀 문의(티켓) 시스템을 구성합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName("패널채널")
        .setDescription("문의 생성 패널을 전송할 채널")
        .addChannelTypes(ChannelType.GuildText)
    )
    .addChannelOption((opt) =>
      opt
        .setName("티켓카테고리")
        .setDescription("생성될 티켓 채널들이 위치할 카테고리")
        .addChannelTypes(ChannelType.GuildCategory)
    )
    .addRoleOption((opt) => opt.setName("담당역할").setDescription("문의를 처리할 운영진 역할")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
      return;
    }

    const panelChannel = interaction.options.getChannel("패널채널");
    const categoryChannel = interaction.options.getChannel("티켓카테고리");
    const supportRole = interaction.options.getRole("담당역할");
    const data = StorageManager.getGuildData(interaction.guild.id);

    if (panelChannel) data.tickets.channelId = panelChannel.id;
    if (categoryChannel) data.tickets.categoryId = categoryChannel.id;
    if (supportRole) data.tickets.supportRoleId = supportRole.id;
    data.tickets.enabled = true;
    StorageManager.saveGuildData(data);

    const categoriesList = data.tickets.categories
      .map((c, i) => `${i + 1}. **${c.label}** (\`${c.id}\`) - ${c.description}`)
      .join("\n");

    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.SETTINGS} 문의(티켓) 시스템 종합 구성 관리\n서버 운영에 맞춤형으로 티켓 카테고리, 담당자 권한, 패널 메시지를 완벽하게 커스텀합니다.\n\n• **패널 채널:** ${data.tickets.channelId ? `<#${data.tickets.channelId}>` : "미지정"}\n• **티켓 카테고리:** ${data.tickets.categoryId ? `<#${data.tickets.categoryId}>` : "미지정"}\n• **담당자 역할:** ${data.tickets.supportRoleId ? `<@&${data.tickets.supportRoleId}>` : "없음"}\n\n### 등록된 문의 유형 (커스텀 카테고리)\n${categoriesList}`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.button("패널 전송하기", "ticket_send_panel"),
          ComponentsV2Builder.button("카테고리 추가", "ticket_add_category_modal"),
          ComponentsV2Builder.button("카테고리 관리", "ticket_manage_categories")
        ),
        ComponentsV2Builder.separator(false, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.emojiButton("CHECK", "ticket_config_save_done"),
          ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
        ),
      ],
      0x5865f2
    );

    await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
  },
};
