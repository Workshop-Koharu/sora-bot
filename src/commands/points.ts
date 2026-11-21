import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { PointsService } from "../services/points.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const pointsCommands = [
  // 1. /포인트 [잔액 | 출석 | 송금 | 랭킹 | 지급]
  {
    data: new SlashCommandBuilder()
      .setName("포인트")
      .setDescription("서버 경제 및 포인트 시스템")
      .addSubcommand((sub) =>
        sub
          .setName("잔액")
          .setDescription("보유 포인트 및 서버 내 랭킹 순위를 확인합니다.")
          .addUserOption((opt) => opt.setName("유저").setDescription("조회할 유저 (기본값: 본인)"))
      )
      .addSubcommand((sub) => sub.setName("출석").setDescription("매일 1회 출석체크를 하고 포인트 보상을 받습니다."))
      .addSubcommand((sub) =>
        sub
          .setName("송금")
          .setDescription("다른 유저에게 포인트를 송금(선물)합니다.")
          .addUserOption((opt) => opt.setName("받는유저").setDescription("송금받을 유저").setRequired(true))
          .addIntegerOption((opt) =>
            opt.setName("금액").setDescription("보낼 포인트 (최소 1P)").setRequired(true).setMinValue(1)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("랭킹").setDescription("서버 내 포인트 보유 상위 랭킹을 확인합니다.")
      )
      .addSubcommand((sub) =>
        sub
          .setName("지급")
          .setDescription("관리자 권한으로 유저에게 포인트를 지급하거나 차감합니다.")
          .addUserOption((opt) => opt.setName("유저").setDescription("대상 유저").setRequired(true))
          .addIntegerOption((opt) =>
            opt.setName("금액").setDescription("지급할 포인트 (음수 입력 시 차감)").setRequired(true)
          )
          .addStringOption((opt) => opt.setName("사유").setDescription("지급 사유"))
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === "출석") {
        const res = PointsService.checkAttendance(guildId, interaction.user.id);
        const userRec = PointsService.getUserRecord(guildId, interaction.user.id);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${res.success ? "🎉 출석체크 완료!" : "⏳ 출석체크 안내"}\n<@${interaction.user.id}> 님, ${res.message}\n\n• **연속 출석:** ${userRec.attendanceStreak}일 연속\n• **현재 잔액:** **${userRec.points.toLocaleString()}P**`
            ),
          ],
          res.success ? 0x57f287 : 0xfee75c
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "잔액") {
        const target = interaction.options.getUser("유저") || interaction.user;
        const record = PointsService.getUserRecord(guildId, target.id);
        const lb = PointsService.getLeaderboard(guildId, 100);
        const rankIdx = lb.findIndex((u) => u.userId === target.id);
        const rankStr = rankIdx !== -1 ? `#${rankIdx + 1}` : "순위권 밖";

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 💰 포인트 잔액 확인\n**유저:** <@${target.id}>\n\n• **보유 잔액:** **${record.points.toLocaleString()}P**\n• **서버 순위:** ${rankStr}\n• **연속 출석:** ${record.attendanceStreak}일`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "송금") {
        const receiver = interaction.options.getUser("받는유저", true);
        const amount = interaction.options.getInteger("금액", true);

        if (receiver.id === interaction.user.id) {
          await interaction.reply({ content: "자신에게는 포인트를 송금할 수 없습니다.", ephemeral: true });
          return;
        }

        if (receiver.bot) {
          await interaction.reply({ content: "봇에게는 포인트를 송금할 수 없습니다.", ephemeral: true });
          return;
        }

        const res = PointsService.transferPoints(guildId, interaction.user.id, receiver.id, amount);
        if (!res.success) {
          await interaction.reply({ content: `송금 실패: ${res.error}`, ephemeral: true });
          return;
        }

        const senderRec = PointsService.getUserRecord(guildId, interaction.user.id);
        const receiverRec = PointsService.getUserRecord(guildId, receiver.id);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 포인트 송금 완료\n<@${interaction.user.id}> 님이 <@${receiver.id}> 님에게 **${amount.toLocaleString()}P**를 송금했습니다.\n\n• **내 남은 잔액:** ${senderRec.points.toLocaleString()}P\n• **상대방 잔액:** ${receiverRec.points.toLocaleString()}P`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "랭킹") {
        const top = PointsService.getLeaderboard(guildId, 10);
        if (top.length === 0) {
          await interaction.reply({ content: "아직 포인트 활동 내역이 없습니다.", ephemeral: true });
          return;
        }

        const lines = top.map((u, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**#${i + 1}**`;
          return `${medal} <@${u.userId}> — **${u.points.toLocaleString()}P** (순위: #${u.rank})`;
        });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🏆 ${interaction.guild.name} 포인트 랭킹 TOP 10\n\n${lines.join("\n")}`
            ),
          ],
          0xfee75c
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "지급") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
          return;
        }

        const target = interaction.options.getUser("유저", true);
        const amount = interaction.options.getInteger("금액", true);
        const reason = interaction.options.getString("사유") || "관리자 지급";

        const rec = PointsService.addPoints(guildId, target.id, amount);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 포인트 관리자 조정 완료\n• **대상 유저:** <@${target.id}>\n• **변동량:** ${amount >= 0 ? `+${amount.toLocaleString()}` : amount.toLocaleString()}P\n• **최종 잔액:** **${rec.points.toLocaleString()}P**\n• **사유:** ${reason}`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }
    },
  },

  // 2. /상점 [목록 | 구매 | 등록]
  {
    data: new SlashCommandBuilder()
      .setName("상점")
      .setDescription("포인트 아이템 상점")
      .addSubcommand((sub) => sub.setName("목록").setDescription("현재 구매 가능한 상점 아이템 목록을 조회합니다."))
      .addSubcommand((sub) =>
        sub
          .setName("구매")
          .setDescription("아이템 번호를 지정하여 구매합니다.")
          .addStringOption((opt) => opt.setName("아이템id").setDescription("구매할 아이템 ID").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("등록")
          .setDescription("새로운 상점 아이템을 등록합니다. (관리자 전용)")
          .addStringOption((opt) => opt.setName("이름").setDescription("아이템 이름").setRequired(true))
          .addIntegerOption((opt) =>
            opt.setName("가격").setDescription("구매 가격 (포인트)").setRequired(true).setMinValue(1)
          )
          .addStringOption((opt) => opt.setName("설명").setDescription("아이템 설명").setRequired(true))
          .addRoleOption((opt) => opt.setName("지급역할").setDescription("구매 시 자동 지급할 역할"))
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;
      const data = StorageManager.getGuildData(guildId);

      if (subcommand === "목록") {
        if (!data.shopItems || data.shopItems.length === 0) {
          const container = ComponentsV2Builder.container(
            [ComponentsV2Builder.text(`# 🛒 상점에 등록된 아이템이 없습니다.`)],
            0x747f8d
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        const lines = data.shopItems.map((item, i) => {
          const roleText = item.roleId ? ` (보상 역할: <@&${item.roleId}>)` : "";
          return `${i + 1}. **${item.name}** (\`${item.id}\`)\n   • 가격: **${item.price.toLocaleString()}P**${roleText}\n   • 설명: ${item.description}`;
        });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🛒 ${interaction.guild.name} 포인트 상점\n\n${lines.join("\n\n")}\n\n> \`/상점 구매 아이템id:<ID>\` 명령어로 구매하세요.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "등록") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
          return;
        }

        const name = interaction.options.getString("이름", true);
        const price = interaction.options.getInteger("가격", true);
        const description = interaction.options.getString("설명", true);
        const role = interaction.options.getRole("지급역할");

        const newItemId = `item_${Date.now()}`;
        if (!data.shopItems) data.shopItems = [];
        data.shopItems.push({
          id: newItemId,
          guildId,
          name,
          price,
          description,
          roleId: role ? role.id : undefined,
        });
        StorageManager.saveGuildData(data);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 상점 아이템 등록 완료!\n• **ID:** \`${newItemId}\`\n• **이름:** ${name}\n• **가격:** ${price.toLocaleString()}P\n• **설명:** ${description}${role ? `\n• **지급역할:** <@&${role.id}>` : ""}`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "구매") {
        const itemId = interaction.options.getString("아이템id", true).trim();
        const item = data.shopItems?.find((it) => it.id === itemId);

        if (!item) {
          await interaction.reply({ content: `\`${itemId}\` 아이템을 찾을 수 없습니다.`, ephemeral: true });
          return;
        }

        const userRec = PointsService.getUserRecord(guildId, interaction.user.id);
        if (userRec.points < item.price) {
          await interaction.reply({
            content: `포인트가 부족합니다. (필요: ${item.price.toLocaleString()}P, 보유: ${userRec.points.toLocaleString()}P)`,
            ephemeral: true,
          });
          return;
        }

        // Deduct points
        PointsService.addPoints(guildId, interaction.user.id, -item.price);

        // Grant role if applicable
        let roleGranted = false;
        if (item.roleId) {
          const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
          if (member) {
            await member.roles.add(item.roleId).catch(() => {});
            roleGranted = true;
          }
        }

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🎉 아이템 구매 성공!\n<@${interaction.user.id}> 님이 **${item.name}**을(를) 구매하셨습니다!\n\n• **결제 금액:** -${item.price.toLocaleString()}P\n• **남은 잔액:** ${(userRec.points - item.price).toLocaleString()}P${roleGranted ? `\n• **지급된 역할:** <@&${item.roleId}>` : ""}`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }
    },
  },
];
