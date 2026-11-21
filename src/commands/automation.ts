import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { GuildAutoRoleConfig, GuildAutoMessageConfig } from "../types/index.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const automationCommands = [
  // 24. /자동역할설정
  {
    data: new SlashCommandBuilder()
      .setName("자동역할설정")
      .setDescription("멤버 가입 시 자동 지급할 역할을 설정합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addRoleOption((opt) => opt.setName("역할").setDescription("자동 지급할 역할").setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName("대상")
          .setDescription("지급 대상 선택")
          .addChoices(
            { name: "모든 멤버", value: "all" },
            { name: "유저만", value: "human" },
            { name: "봇만", value: "bot" }
          )
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const role = interaction.options.getRole("역할", true);
      const target = (interaction.options.getString("대상") || "human") as "all" | "human" | "bot";
      const data = StorageManager.getGuildData(interaction.guild.id);

      const targetText = target === "all" ? "모든 멤버" : target === "human" ? "일반 유저만" : "봇만";

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SETTINGS} 자동 역할 설정 확인\n**새로운 자동 역할 규칙을 등록하시겠습니까?**\n\n• **지급 역할:** <@&${role.id}> (\`${role.id}\`)\n• **적용 대상:** ${targetText}\n• **등록 전 기존 규칙 수:** ${data.autoRoles.length}개`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CHECK", `confirm_autorole_add_${role.id}_${target}`),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 25. /자동역할목록
  {
    data: new SlashCommandBuilder()
      .setName("자동역할목록")
      .setDescription("등록된 자동 역할 규칙 목록을 확인합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const data = StorageManager.getGuildData(interaction.guild.id);
      if (data.autoRoles.length === 0) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 자동 역할 목록\n등록된 자동 역할 규칙이 없습니다.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      const rows = data.autoRoles.map((r, i) => {
        return `${i + 1}. \`${r.id}\` | 역할: <@&${r.roleId}> | 대상: **${r.target}**`;
      });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.FILTER} 자동 역할 규칙 목록 [총 ${data.autoRoles.length}개]\n**페이지: [1/1]**\n\n${rows.join("\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("PREV", "autorole_list_prev", { disabled: true }),
            ComponentsV2Builder.emojiButton("NEXT", "autorole_list_next", { disabled: true })
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 26. /자동역할삭제
  {
    data: new SlashCommandBuilder()
      .setName("자동역할삭제")
      .setDescription("지정한 자동 역할 규칙을 삭제합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) => opt.setName("규칙id").setDescription("삭제할 자동역할 규칙 ID").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const ruleId = interaction.options.getString("규칙id", true);
      const data = StorageManager.getGuildData(interaction.guild.id);
      const targetRule = data.autoRoles.find((r) => r.id === ruleId);

      if (!targetRule) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.EXCLAMATION} 대상 없음\n규칙 ID \`${ruleId}\`를 찾을 수 없습니다.`
            ),
          ],
          0xed4245
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.EXCLAMATION} 자동 역할 삭제 확인\n**정말로 이 자동 역할 규칙을 삭제하시겠습니까?**\n\n• **규칙 ID:** \`${targetRule.id}\`\n• **지급 역할:** <@&${targetRule.roleId}>\n• **적용 대상:** ${targetRule.target}\n• **영향:** 이후 가입하는 대상에게 해당 역할이 지급되지 않습니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CHECK", `confirm_autorole_del_${ruleId}`),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0xed4245
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 27. /자동메시지설정
  {
    data: new SlashCommandBuilder()
      .setName("자동메시지설정")
      .setDescription("지정 채널에 정기적으로 전송할 자동 메시지를 등록합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((opt) =>
        opt
          .setName("채널")
          .setDescription("메시지를 전송할 채널")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("주기")
          .setDescription("반복 주기 (분 단위)")
          .setRequired(true)
          .setMinValue(5)
          .setMaxValue(10080)
      )
      .addStringOption((opt) => opt.setName("내용").setDescription("메시지 내용").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const ch = interaction.options.getChannel("채널", true);
      const minutes = interaction.options.getInteger("주기", true);
      const content = interaction.options.getString("내용", true);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SETTINGS} 자동 메시지 등록 확인\n• **대상 채널:** <#${ch.id}>\n• **반복 주기:** 매 ${minutes}분마다\n• **전송 내용:**\n\`${content}\``
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CHECK", `confirm_automsg_add_${ch.id}_${minutes}_${encodeURIComponent(content.slice(0, 50))}`),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 28. /자동메시지목록
  {
    data: new SlashCommandBuilder()
      .setName("자동메시지목록")
      .setDescription("등록된 자동 메시지 목록을 페이지 단위로 확인합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const data = StorageManager.getGuildData(interaction.guild.id);
      if (data.autoMessages.length === 0) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 자동 메시지 목록\n등록된 자동 메시지가 없습니다.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      const rows = data.autoMessages.map((m, i) => {
        return `${i + 1}. \`${m.id}\` | <#${m.channelId}> | 주기: ${m.intervalMinutes}분 | 상태: **${m.enabled ? "동작 중" : "중지됨"}**`;
      });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.FILTER} 자동 메시지 목록 [총 ${data.autoMessages.length}개]\n**페이지: [1/1]**\n\n${rows.join("\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("PREV", "automsg_list_prev", { disabled: true }),
            ComponentsV2Builder.emojiButton("NEXT", "automsg_list_next", { disabled: true })
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 29. /자동메시지중지
  {
    data: new SlashCommandBuilder()
      .setName("자동메시지중지")
      .setDescription("등록된 자동 메시지를 일시 중지하거나 재개합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) => opt.setName("메시지id").setDescription("대상 메시지 ID").setRequired(true))
      .addBooleanOption((opt) => opt.setName("중지").setDescription("true면 중지, false면 재개").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const msgId = interaction.options.getString("메시지id", true);
      const pause = interaction.options.getBoolean("중지", true);
      const data = StorageManager.getGuildData(interaction.guild.id);
      const target = data.autoMessages.find((m) => m.id === msgId);

      if (!target) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.EXCLAMATION} 대상 없음\n메시지 ID \`${msgId}\`를 찾을 수 없습니다.`
            ),
          ],
          0xed4245
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      target.enabled = !pause;
      StorageManager.saveGuildData(data);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 자동 메시지 상태 변경\n메시지 ID \`${msgId}\`가 성공적으로 **${pause ? "일시 중지" : "재개"}**되었습니다.`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },
];
