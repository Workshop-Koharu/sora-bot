import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { WarningRecord } from "../types/index.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const moderationCommands = [
  // 9. /경고
  {
    data: new SlashCommandBuilder()
      .setName("경고")
      .setDescription("지정한 멤버에게 경고를 부여합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) => opt.setName("멤버").setDescription("대상 멤버").setRequired(true))
      .addStringOption((opt) => opt.setName("사유").setDescription("경고 사유").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser("멤버", true);
      const reason = interaction.options.getString("사유", true);
      const data = StorageManager.getGuildData(interaction.guild.id);

      const warnId = `warn_${Date.now()}`;
      const record: WarningRecord = {
        id: warnId,
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        reason,
        createdAt: new Date().toISOString(),
        active: true,
      };

      data.warnings.push(record);
      data.moderationAudit.push({
        id: `audit_${Date.now()}`,
        guildId: interaction.guild.id,
        type: "warn",
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason,
        createdAt: new Date().toISOString(),
      });
      StorageManager.saveGuildData(data);

      const activeCount = data.warnings.filter((w) => w.userId === targetUser.id && w.active).length;

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 경고 부여 완료\n**대상:** <@${targetUser.id}> (\`${targetUser.id}\`)\n**사유:** ${reason}\n**경고 식별 번호:** \`${warnId}\`\n**누적 활성 경고 수:** ${activeCount}회`
          ),
        ],
        0xfee75c
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 10. /경고제거
  {
    data: new SlashCommandBuilder()
      .setName("경고제거")
      .setDescription("경고 ID를 지정하여 해당 경고를 취소/비활성화합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) => opt.setName("경고id").setDescription("제거할 경고 번호").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const warnId = interaction.options.getString("경고id", true).trim();
      const data = StorageManager.getGuildData(interaction.guild.id);
      const target = data.warnings.find((w) => w.id === warnId);

      if (!target) {
        const errContainer = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.EXCLAMATION} 대상 없음\n지정한 경고 ID \`${warnId}\`를 찾을 수 없습니다.`
            ),
          ],
          0xed4245
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(errContainer, true));
        return;
      }

      if (!target.active) {
        const errContainer = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.EXCLAMATION} 이미 처리됨\n경고 ID \`${warnId}\`는 이미 비활성화(취소)된 상태입니다.`
            ),
          ],
          0xed4245
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(errContainer, true));
        return;
      }

      target.active = false;
      data.moderationAudit.push({
        id: `audit_${Date.now()}`,
        guildId: interaction.guild.id,
        type: "warn_remove",
        targetId: target.userId,
        moderatorId: interaction.user.id,
        reason: `경고 제거: ${warnId}`,
        createdAt: new Date().toISOString(),
      });
      StorageManager.saveGuildData(data);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 경고 제거 완료\n경고 ID \`${warnId}\` (대상: <@${target.userId}>)가 정상적으로 취소 처리되었습니다.`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 11. /경고목록
  {
    data: new SlashCommandBuilder()
      .setName("경고목록")
      .setDescription("서버 내 경고 목록을 페이지 단위로 조회합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) => opt.setName("멤버").setDescription("특정 멤버의 경고만 필터"))
      .addBooleanOption((opt) => opt.setName("활성만").setDescription("활성 경고만 조회할지 여부")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const target = interaction.options.getUser("멤버");
      const onlyActive = interaction.options.getBoolean("활성만") ?? true;
      const data = StorageManager.getGuildData(interaction.guild.id);

      let list = data.warnings;
      if (target) list = list.filter((w) => w.userId === target.id);
      if (onlyActive) list = list.filter((w) => w.active);

      if (list.length === 0) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 경고 내역 없음\n조건에 부합하는 경고 기록이 없습니다.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      const rows = list.slice(0, 5).map((w, i) => {
        return `${i + 1}. \`${w.id}\` | <@${w.userId}> | 사유: **${w.reason}** | 상태: ${w.active ? "활성" : "취소됨"}`;
      });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.FILTER} 경고 목록 [총 ${list.length}건]\n**페이지: [1/1]**\n\n${rows.join("\n\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("PREV", "warn_list_prev", { disabled: true }),
            ComponentsV2Builder.emojiButton("NEXT", "warn_list_next", { disabled: true }),
            ComponentsV2Builder.emojiButton("FILTER", "warn_list_filter")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 12. /타임아웃
  {
    data: new SlashCommandBuilder()
      .setName("타임아웃")
      .setDescription("멤버의 대화 및 반응을 일정 시간 제한합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) => opt.setName("멤버").setDescription("대상 멤버").setRequired(true))
      .addIntegerOption((opt) =>
        opt
          .setName("시간")
          .setDescription("타임아웃 시간(분 단위)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320)
      )
      .addStringOption((opt) => opt.setName("사유").setDescription("사유")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const user = interaction.options.getUser("멤버", true);
      const minutes = interaction.options.getInteger("시간", true);
      const reason = interaction.options.getString("사유") || "사유 미작성";

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "서버 내 멤버를 찾을 수 없습니다.", ephemeral: true });
        return;
      }

      if (!member.moderatable) {
        await interaction.reply({ content: "봇의 역할 권한이 대상보다 낮아 타임아웃을 적용할 수 없습니다.", ephemeral: true });
        return;
      }

      await member.timeout(minutes * 60 * 1000, reason);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 타임아웃 적용 완료\n**대상:** <@${user.id}>\n**시간:** ${minutes}분\n**사유:** ${reason}`
          ),
        ],
        0xfee75c
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 13. /타임아웃해제
  {
    data: new SlashCommandBuilder()
      .setName("타임아웃해제")
      .setDescription("멤버의 타임아웃을 해제합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) => opt.setName("멤버").setDescription("대상 멤버").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const user = interaction.options.getUser("멤버", true);
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        await interaction.reply({ content: "서버 내 멤버를 찾을 수 없습니다.", ephemeral: true });
        return;
      }

      if (!member.isCommunicationDisabled()) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.EXCLAMATION} 대상 없음\n<@${user.id}> 멤버는 현재 타임아웃 상태가 아닙니다.`
            ),
          ],
          0xed4245
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      await member.timeout(null, "타임아웃 관리자 수동 해제");

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 타임아웃 해제 완료\n<@${user.id}> 멤버의 타임아웃이 정상 해제되었습니다.`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 14. /킥
  {
    data: new SlashCommandBuilder()
      .setName("킥")
      .setDescription("멤버를 서버에서 추방합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) => opt.setName("멤버").setDescription("추방할 멤버").setRequired(true))
      .addStringOption((opt) => opt.setName("사유").setDescription("추방 사유")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const user = interaction.options.getUser("멤버", true);
      const reason = interaction.options.getString("사유") || "관리자 추방";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member || !member.kickable) {
        await interaction.reply({ content: "권한이 없거나 대상을 추방할 수 없습니다.", ephemeral: true });
        return;
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.EXCLAMATION} 멤버 추방 확인\n정말로 <@${user.id}> 멤버를 서버에서 추방하시겠습니까?\n**사유:** ${reason}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CHECK", `confirm_kick_${user.id}`),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0xed4245
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 15. /밴
  {
    data: new SlashCommandBuilder()
      .setName("밴")
      .setDescription("멤버를 서버에서 영구 차단합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) => opt.setName("멤버").setDescription("차단할 멤버").setRequired(true))
      .addStringOption((opt) => opt.setName("사유").setDescription("차단 사유")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const user = interaction.options.getUser("멤버", true);
      const reason = interaction.options.getString("사유") || "관리자 차단";

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.EXCLAMATION} 멤버 영구 차단(밴) 확인\n정말로 <@${user.id}> (\`${user.id}\`) 유저를 차단하시겠습니까?\n**사유:** ${reason}\n\n차단 시 재입장이 불가능합니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CHECK", `confirm_ban_${user.id}`),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0xed4245
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 16. /밴해제
  {
    data: new SlashCommandBuilder()
      .setName("밴해제")
      .setDescription("차단된 유저의 밴을 해제합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) => opt.setName("유저id").setDescription("차단 해제할 유저 ID").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const userId = interaction.options.getString("유저id", true).trim();

      try {
        const banInfo = await interaction.guild.bans.fetch(userId).catch(() => null);
        if (!banInfo) {
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.EXCLAMATION} 대상 없음\nID \`${userId}\`는 차단 목록에 존재하지 않습니다.`
              ),
            ],
            0xed4245
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        await interaction.guild.bans.remove(userId, "관리자 수동 밴 해제");

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 밴 해제 완료\n유저 \`${userId}\` (${banInfo.user.username})의 차단이 해제되었습니다.`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
      } catch (err: any) {
        await interaction.reply({ content: `밴 해제 실패: ${err.message}`, ephemeral: true });
      }
    },
  },

  // 17. /차단목록
  {
    data: new SlashCommandBuilder()
      .setName("차단목록")
      .setDescription("서버의 차단된 유저 목록을 페이지 단위로 확인합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const bans = await interaction.guild.bans.fetch();

      if (bans.size === 0) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 차단 목록 비어있음\n현재 서버에 차단된 유저가 없습니다.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      const rows = Array.from(bans.values())
        .slice(0, 5)
        .map((b, i) => `${i + 1}. **${b.user.username}** (\`${b.user.id}\`) - 사유: ${b.reason || "없음"}`);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.FILTER} 서버 차단 목록 [총 ${bans.size}명]\n**페이지: [1/1]**\n\n${rows.join("\n\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("PREV", "ban_list_prev", { disabled: true }),
            ComponentsV2Builder.emojiButton("NEXT", "ban_list_next", { disabled: true })
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },
];
