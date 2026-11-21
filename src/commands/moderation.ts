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
  // 1. /경고 [추가 | 목록 | 제거 | 초기화]
  {
    data: new SlashCommandBuilder()
      .setName("경고")
      .setDescription("서버 멤버 경고 관리 시스템 (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) =>
        sub
          .setName("추가")
          .setDescription("유저에게 경고를 부여합니다.")
          .addUserOption((opt) => opt.setName("유저").setDescription("경고를 부여할 대상 유저").setRequired(true))
          .addStringOption((opt) => opt.setName("사유").setDescription("경고 사유").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("목록")
          .setDescription("유저의 활성 및 전체 경고 내역을 조회합니다.")
          .addUserOption((opt) => opt.setName("유저").setDescription("조회할 유저").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("제거")
          .setDescription("특정 경고 ID를 지정하여 해당 경고를 취소합니다.")
          .addStringOption((opt) => opt.setName("경고id").setDescription("취소할 경고 ID (예: warn_...)").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("초기화")
          .setDescription("유저의 모든 활성 경고를 일괄 초기화합니다.")
          .addUserOption((opt) => opt.setName("유저").setDescription("초기화할 대상 유저").setRequired(true))
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const data = StorageManager.getGuildData(interaction.guild.id);

      if (subcommand === "추가") {
        const targetUser = interaction.options.getUser("유저", true);
        const reason = interaction.options.getString("사유", true);

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
              `# ${EMOJI_STRINGS.CHECK} 경고 부여 완료\n**대상 유저:** <@${targetUser.id}> (\`${targetUser.id}\`)\n**사유:** ${reason}\n**경고 번호:** \`${warnId}\`\n**누적 활성 경고:** ${activeCount}회`
            ),
          ],
          0xfee75c
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "목록") {
        const targetUser = interaction.options.getUser("유저", true);
        const userWarnings = data.warnings.filter((w) => w.userId === targetUser.id);

        if (userWarnings.length === 0) {
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.CHECK} 경고 내역 없음\n<@${targetUser.id}> 님은 부여된 경고 내역이 없습니다.`
              ),
            ],
            0x57f287
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        const lines = userWarnings.map((w, idx) => {
          const status = w.active ? "[활성]" : "[해제됨]";
          const date = new Date(w.createdAt).toLocaleDateString("ko-KR");
          return `${idx + 1}. \`${w.id}\` ${status} **${w.reason}** (담당: <@${w.moderatorId}>, ${date})`;
        });

        const activeTotal = userWarnings.filter((w) => w.active).length;
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.EXCLAMATION} 경고 이력 조회\n**대상 유저:** <@${targetUser.id}> (총 ${userWarnings.length}건, 현재 활성 ${activeTotal}건)\n\n${lines.join("\n")}`
            ),
          ],
          0xfee75c
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "제거") {
        const warnId = interaction.options.getString("경고id", true).trim();
        const target = data.warnings.find((w) => w.id === warnId);

        if (!target) {
          const err = ComponentsV2Builder.container(
            [ComponentsV2Builder.text(`# ${EMOJI_STRINGS.EXCLAMATION} 경고 ID \`${warnId}\`를 찾을 수 없습니다.`)],
            0xed4245
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(err, true));
          return;
        }

        if (!target.active) {
          const info = ComponentsV2Builder.container(
            [ComponentsV2Builder.text(`# ${EMOJI_STRINGS.HELP} 해당 경고는 이미 취소/해제된 상태입니다.`)],
            0x747f8d
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(info, true));
          return;
        }

        target.active = false;
        data.moderationAudit.push({
          id: `audit_${Date.now()}`,
          guildId: interaction.guild.id,
          type: "warn_remove",
          targetId: target.userId,
          moderatorId: interaction.user.id,
          reason: `경고 취소 (${warnId})`,
          createdAt: new Date().toISOString(),
        });
        StorageManager.saveGuildData(data);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 경고 취소 완료\n경고 ID \`${warnId}\`가 정상 취소되었습니다.\n**대상 유저:** <@${target.userId}>`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "초기화") {
        const targetUser = interaction.options.getUser("유저", true);
        let resetCount = 0;

        for (const w of data.warnings) {
          if (w.userId === targetUser.id && w.active) {
            w.active = false;
            resetCount++;
          }
        }

        if (resetCount > 0) {
          data.moderationAudit.push({
            id: `audit_${Date.now()}`,
            guildId: interaction.guild.id,
            type: "warn_remove",
            targetId: targetUser.id,
            moderatorId: interaction.user.id,
            reason: `전체 경고 일괄 초기화 (${resetCount}건)`,
            createdAt: new Date().toISOString(),
          });
          StorageManager.saveGuildData(data);
        }

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 경고 초기화 완료\n<@${targetUser.id}> 님의 활성 경고 ${resetCount}건이 모두 해제되었습니다.`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }
    },
  },

  // 2. /타임아웃 [설정 | 해제]
  {
    data: new SlashCommandBuilder()
      .setName("타임아웃")
      .setDescription("멤버 채팅 및 반응 제한 (타임아웃) 관리 (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addSubcommand((sub) =>
        sub
          .setName("설정")
          .setDescription("유저에게 지정 시간 동안 타임아웃을 적용합니다.")
          .addUserOption((opt) => opt.setName("유저").setDescription("타임아웃 대상 유저").setRequired(true))
          .addIntegerOption((opt) =>
            opt
              .setName("시간")
              .setDescription("타임아웃 시간(분 단위, 최대 40320분/28일)")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(40320)
          )
          .addStringOption((opt) => opt.setName("사유").setDescription("타임아웃 사유"))
      )
      .addSubcommand((sub) =>
        sub
          .setName("해제")
          .setDescription("유저의 타임아웃을 즉시 해제합니다.")
          .addUserOption((opt) => opt.setName("유저").setDescription("해제 대상 유저").setRequired(true))
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const subcommand = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser("유저", true);
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        await interaction.reply({ content: "서버에서 유저를 찾을 수 없습니다.", ephemeral: true });
        return;
      }

      if (subcommand === "설정") {
        const minutes = interaction.options.getInteger("시간", true);
        const reason = interaction.options.getString("사유") || "사유 미작성";
        const durationMs = minutes * 60 * 1000;

        try {
          await member.timeout(durationMs, `${interaction.user.tag}: ${reason}`);
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.CHECK} 타임아웃 적용 완료\n**대상 유저:** <@${targetUser.id}>\n**적용 시간:** ${minutes}분\n**사유:** ${reason}`
              ),
            ],
            0xfee75c
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        } catch (err: any) {
          await interaction.reply({ content: `타임아웃 적용 실패: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (subcommand === "해제") {
        try {
          await member.timeout(null, `타임아웃 해제: ${interaction.user.tag}`);
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.CHECK} 타임아웃 해제 완료\n<@${targetUser.id}> 님의 타임아웃이 해제되었습니다.`
              ),
            ],
            0x57f287
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        } catch (err: any) {
          await interaction.reply({ content: `타임아웃 해제 실패: ${err.message}`, ephemeral: true });
        }
        return;
      }
    },
  },

  // 3. /차단 [설정 | 해제 | 목록]
  {
    data: new SlashCommandBuilder()
      .setName("차단")
      .setDescription("서버 멤버 영구/임시 차단 관리 (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addSubcommand((sub) =>
        sub
          .setName("설정")
          .setDescription("유저를 서버에서 차단합니다.")
          .addUserOption((opt) => opt.setName("유저").setDescription("차단할 유저").setRequired(true))
          .addStringOption((opt) => opt.setName("사유").setDescription("차단 사유"))
          .addIntegerOption((opt) =>
            opt
              .setName("메시지삭제일수")
              .setDescription("해당 유저의 이전 메시지 삭제 범위 (일 단위, 0~7)")
              .setMinValue(0)
              .setMaxValue(7)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("해제")
          .setDescription("차단된 유저의 차단을 해제합니다.")
          .addStringOption((opt) => opt.setName("유저id").setDescription("차단 해제할 유저의 ID").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("목록")
          .setDescription("현재 서버의 차단된 유저 목록을 조회합니다.")
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "설정") {
        const targetUser = interaction.options.getUser("유저", true);
        const reason = interaction.options.getString("사유") || "사유 미작성";
        const deleteDays = interaction.options.getInteger("메시지삭제일수") || 0;

        try {
          await interaction.guild.bans.create(targetUser.id, {
            reason: `${interaction.user.tag}: ${reason}`,
            deleteMessageSeconds: deleteDays * 86400,
          });

          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.CHECK} 유저 차단 완료\n**차단 유저:** <@${targetUser.id}> (\`${targetUser.id}\`)\n**사유:** ${reason}\n**메시지 삭제:** ${deleteDays}일치`
              ),
            ],
            0xed4245
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        } catch (err: any) {
          await interaction.reply({ content: `차단 실패: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (subcommand === "해제") {
        const userId = interaction.options.getString("유저id", true).trim();
        try {
          await interaction.guild.bans.remove(userId, `차단 해제: ${interaction.user.tag}`);
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.CHECK} 차단 해제 완료\n유저 ID \`${userId}\`의 차단이 정상 해제되었습니다.`
              ),
            ],
            0x57f287
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        } catch (err: any) {
          await interaction.reply({ content: `차단 해제 실패: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (subcommand === "목록") {
        try {
          const bans = await interaction.guild.bans.fetch({ limit: 20 });
          if (bans.size === 0) {
            const container = ComponentsV2Builder.container(
              [ComponentsV2Builder.text(`# ${EMOJI_STRINGS.CHECK} 차단된 유저가 없습니다.`)],
              0x57f287
            );
            await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
            return;
          }

          const banList = bans
            .map((b) => `• **${b.user.tag}** (\`${b.user.id}\`) - 사유: ${b.reason || "없음"}`)
            .join("\n");

          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.HELP} 서버 차단 목록 (최대 20건)\n${banList}`
              ),
            ],
            0x747f8d
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        } catch (err: any) {
          await interaction.reply({ content: `목록 조회 실패: ${err.message}`, ephemeral: true });
        }
        return;
      }
    },
  },

  // 4. /추방 [유저] [사유]
  {
    data: new SlashCommandBuilder()
      .setName("추방")
      .setDescription("서버에서 멤버를 추방(Kick)합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((opt) => opt.setName("유저").setDescription("추방할 멤버").setRequired(true))
      .addStringOption((opt) => opt.setName("사유").setDescription("추방 사유")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;
      const targetUser = interaction.options.getUser("유저", true);
      const reason = interaction.options.getString("사유") || "사유 미작성";

      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "서버에서 유저를 찾을 수 없습니다.", ephemeral: true });
        return;
      }

      try {
        await member.kick(`${interaction.user.tag}: ${reason}`);
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 유저 추방 완료\n**추방 멤버:** <@${targetUser.id}> (\`${targetUser.id}\`)\n**사유:** ${reason}`
            ),
          ],
          0xfee75c
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
      } catch (err: any) {
        await interaction.reply({ content: `추방 실패: ${err.message}`, ephemeral: true });
      }
    },
  },

  // 5. /청소 [개수]
  {
    data: new SlashCommandBuilder()
      .setName("청소")
      .setDescription("채널의 최근 메시지를 대량 삭제합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption((opt) =>
        opt
          .setName("개수")
          .setDescription("삭제할 메시지 개수 (1~100)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.channel || !("bulkDelete" in interaction.channel)) {
        await interaction.reply({ content: "이 채널에서는 메시지 청소를 지원하지 않습니다.", ephemeral: true });
        return;
      }

      const count = interaction.options.getInteger("개수", true);
      try {
        await interaction.deferReply({ ephemeral: true });
        const deleted = await interaction.channel.bulkDelete(count, true);
        await interaction.editReply({
          content: `${deleted.size}개의 메시지를 정상적으로 청소했습니다. (14일 이상 지난 메시지는 제외됩니다)`,
        });
      } catch (err: any) {
        await interaction.editReply({ content: `메시지 청소 실패: ${err.message}` });
      }
    },
  },
];
