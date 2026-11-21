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
  // 59. /출석체크
  {
    data: new SlashCommandBuilder()
      .setName("출석체크")
      .setDescription("하루 한 번 출석체크를 하고 포인트와 연속 출석 보너스를 받습니다."),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const res = PointsService.checkAttendance(interaction.guild.id, interaction.user.id);
      const user = PointsService.getUserRecord(interaction.guild.id, interaction.user.id);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${res.success ? "🎉 출석체크 성공!" : "⏳ 출석체크 안내"}\n<@${interaction.user.id}> 님, ${res.message}\n\n• **연속 출석:** ${user.attendanceStreak}일 연속 달성\n• **현재 보유 포인트:** **${user.points.toLocaleString()}P**`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("내 잔액 확인", `points_view_balance_${interaction.user.id}`),
            ComponentsV2Builder.button("포인트 상점", "points_view_shop")
          ),
        ],
        res.success ? 0x57f287 : 0xfee75c
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 60. /포인트잔액
  {
    data: new SlashCommandBuilder()
      .setName("포인트잔액")
      .setDescription("보유 중인 포인트 잔액과 랭킹을 확인합니다.")
      .addUserOption((opt) => opt.setName("유저").setDescription("조회할 유저 (미지정 시 본인)")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const target = interaction.options.getUser("유저") || interaction.user;
      const record = PointsService.getUserRecord(interaction.guild.id, target.id);
      const lb = PointsService.getLeaderboard(interaction.guild.id, 100);
      const rankIdx = lb.findIndex((u) => u.userId === target.id);
      const rankText = rankIdx !== -1 ? `#${rankIdx + 1}` : "순위권 밖";

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 💰 ${target.username} 님의 포인트 지갑\n• **보유 포인트:** **${record.points.toLocaleString()} P**\n• **서버 내 순위:** **${rankText}**\n• **연속 출석 일수:** ${record.attendanceStreak}일\n• **보유 아이템:** ${record.inventory.length}개`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("상점 둘러보기", "points_view_shop"),
            ComponentsV2Builder.button("포인트 랭킹", "points_view_rankings")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 61. /포인트송금
  {
    data: new SlashCommandBuilder()
      .setName("포인트송금")
      .setDescription("다른 멤버에게 포인트를 송금합니다.")
      .addUserOption((opt) => opt.setName("대상").setDescription("송금받을 멤버").setRequired(true))
      .addIntegerOption((opt) => opt.setName("금액").setDescription("보낼 포인트").setRequired(true).setMinValue(1)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const receiver = interaction.options.getUser("대상", true);
      const amount = interaction.options.getInteger("금액", true);

      const res = PointsService.transferPoints(interaction.guild.id, interaction.user.id, receiver.id, amount);
      if (!res.success) {
        await interaction.reply({ content: `송금 실패: ${res.error}`, ephemeral: true });
        return;
      }

      const senderRecord = PointsService.getUserRecord(interaction.guild.id, interaction.user.id);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 💸 포인트 송금 완료\n<@${interaction.user.id}> 님이 <@${receiver.id}> 님에게 **${amount.toLocaleString()} P**를 송금했습니다.\n\n• **송금 후 잔액:** ${senderRecord.points.toLocaleString()} P`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 62. /포인트도박
  {
    data: new SlashCommandBuilder()
      .setName("포인트도박")
      .setDescription("포인트를 걸고 동전 던지기 또는 주사위 게임을 진행합니다.")
      .addStringOption((opt) =>
        opt
          .setName("게임")
          .setDescription("게임 종류 선택")
          .setRequired(true)
          .addChoices(
            { name: "동전 뒤집기 (성공 시 2배)", value: "coinflip" },
            { name: "주사위 굴리기 (성공 시 1.8배)", value: "dice" }
          )
      )
      .addIntegerOption((opt) => opt.setName("배팅금액").setDescription("배팅할 포인트").setRequired(true).setMinValue(10)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const game = interaction.options.getString("게임", true) as "coinflip" | "dice";
      const amount = interaction.options.getInteger("배팅금액", true);

      try {
        const result = PointsService.gamblePoints(interaction.guild.id, interaction.user.id, amount, game);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🎰 포인트 베팅 결과\n<@${interaction.user.id}> 님의 **${amount.toLocaleString()} P** 베팅!\n\n• ${result.detail}\n• **${result.win ? `🎉 +${result.reward.toLocaleString()} P 획득!` : "💀 배팅금을 모두 잃었습니다."}**\n• **현재 잔액:** **${result.balance.toLocaleString()} P**`
            ),
            ComponentsV2Builder.separator(true, 1),
            ComponentsV2Builder.actionRow(
              ComponentsV2Builder.button("한 번 더!", `gamble_retry_${game}_${amount}`)
            ),
          ],
          result.win ? 0x57f287 : 0xed4245
        );

        await interaction.reply(ComponentsV2Builder.formatMessage(container));
      } catch (err: any) {
        await interaction.reply({ content: `베팅 오류: ${err.message}`, ephemeral: true });
      }
    },
  },

  // 63. /포인트랭킹
  {
    data: new SlashCommandBuilder()
      .setName("포인트랭킹")
      .setDescription("서버 내 포인트 부자 랭킹 TOP 10을 확인합니다."),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const lb = PointsService.getLeaderboard(interaction.guild.id, 10);
      if (lb.length === 0) {
        await interaction.reply({ content: "등록된 포인트 기록이 없습니다.", ephemeral: true });
        return;
      }

      const rows = lb.map((u) => {
        const medal = u.rank === 1 ? "🥇" : u.rank === 2 ? "🥈" : u.rank === 3 ? "🥉" : `**#${u.rank}**`;
        return `${medal} <@${u.userId}> — **${u.points.toLocaleString()} P**`;
      });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 🏆 ${interaction.guild.name} 포인트 명예의 전당 TOP 10\n\n${rows.join("\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("RELOAD", "points_rank_refresh")
          ),
        ],
        0xfee75c
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 64. /포인트상점
  {
    data: new SlashCommandBuilder()
      .setName("포인트상점")
      .setDescription("포인트로 구매 가능한 서버 아이템 및 역할 목록을 확인합니다."),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const data = StorageManager.getGuildData(interaction.guild.id);
      const items = data.shopItems;

      if (items.length === 0) {
        await interaction.reply({ content: "현재 상점에 등록된 상품이 없습니다.", ephemeral: true });
        return;
      }

      const rows = items.map((it, idx) => {
        return `${idx + 1}. **${it.name}** (\`${it.id}\`) — **${it.price.toLocaleString()} P**\n> ${it.description}`;
      });

      const selectOptions = items.slice(0, 10).map((it) => ({
        label: it.name,
        value: it.id,
        description: `${it.price.toLocaleString()}P - ${it.description.slice(0, 40)}`,
      }));

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 🛒 포인트 상점\n포인트를 모아 원하는 역할과 특별한 아이템을 구매하세요!\n\n${rows.join("\n\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.stringSelect("shop_buy_select", selectOptions, "구매할 상품을 선택하세요")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 65. /포인트구매
  {
    data: new SlashCommandBuilder()
      .setName("포인트구매")
      .setDescription("상점에서 상품을 즉시 구매합니다.")
      .addStringOption((opt) => opt.setName("상품id").setDescription("구매할 상품 ID (예: vip_role)").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const itemId = interaction.options.getString("상품id", true);
      const res = PointsService.buyShopItem(interaction.guild.id, interaction.user.id, itemId);

      if (!res.success) {
        await interaction.reply({ content: `구매 실패: ${res.error}`, ephemeral: true });
        return;
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 🎉 아이템 구매 성공!\n<@${interaction.user.id}> 님이 **${res.item?.name}**을(를) **${res.item?.price.toLocaleString()} P**에 성공적으로 구매하셨습니다!\n\n인벤토리에 보관되었습니다.`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 66. /포인트인벤토리
  {
    data: new SlashCommandBuilder()
      .setName("포인트인벤토리")
      .setDescription("내가 보유 중인 아이템 목록을 확인합니다."),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const user = PointsService.getUserRecord(interaction.guild.id, interaction.user.id);

      if (user.inventory.length === 0) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🎒 내 인벤토리\n보유 중인 아이템이 없습니다. \`/포인트상점\`에서 상품을 둘러보세요!`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      const rows = user.inventory.map((inv, idx) => {
        return `${idx + 1}. **${inv.itemName}** (\`${inv.itemId}\`) - 획득일: ${inv.acquiredAt.slice(0, 10)}`;
      });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 🎒 <@${interaction.user.id}> 님의 인벤토리 [총 ${user.inventory.length}개]\n\n${rows.join("\n")}`
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 67. /포인트선물
  {
    data: new SlashCommandBuilder()
      .setName("포인트선물")
      .setDescription("내 인벤토리의 아이템을 다른 유저에게 선물합니다.")
      .addUserOption((opt) => opt.setName("받는유저").setDescription("선물할 유저").setRequired(true))
      .addStringOption((opt) => opt.setName("아이템id").setDescription("선물할 아이템 ID").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const target = interaction.options.getUser("받는유저", true);
      const itemId = interaction.options.getString("아이템id", true);

      if (target.id === interaction.user.id) {
        await interaction.reply({ content: "자기 자신에게는 선물할 수 없습니다.", ephemeral: true });
        return;
      }

      const sender = PointsService.getUserRecord(interaction.guild.id, interaction.user.id);
      const receiver = PointsService.getUserRecord(interaction.guild.id, target.id);

      const itemIdx = sender.inventory.findIndex((i) => i.itemId === itemId);
      if (itemIdx === -1) {
        await interaction.reply({ content: `인벤토리에 아이템 '${itemId}'가 없습니다.`, ephemeral: true });
        return;
      }

      const [gifted] = sender.inventory.splice(itemIdx, 1);
      receiver.inventory.push({
        itemId: gifted.itemId,
        itemName: gifted.itemName,
        acquiredAt: new Date().toISOString(),
      });

      const data = StorageManager.getGuildData(interaction.guild.id);
      data.points[interaction.user.id] = sender;
      data.points[target.id] = receiver;
      StorageManager.saveGuildData(data);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 🎁 아이템 선물 완료!\n<@${interaction.user.id}> 님이 <@${target.id}> 님에게 **${gifted.itemName}**을(를) 선물했습니다.`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 68. /포인트복권
  {
    data: new SlashCommandBuilder()
      .setName("포인트복권")
      .setDescription("500P로 복권을 구매하여 잭팟에 도전합니다!"),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const price = 500;
      const user = PointsService.getUserRecord(interaction.guild.id, interaction.user.id);

      if (user.points < price) {
        await interaction.reply({ content: `포인트가 부족합니다. (필요: ${price}P, 보유: ${user.points}P)`, ephemeral: true });
        return;
      }

      user.points -= price;

      // Lottery draw: 1% jackpot (10,000P), 5% 2nd (2,000P), 20% 3rd (1,000P), 30% 4th (500P refund), 44% loss
      const rand = Math.random() * 100;
      let prize = 0;
      let rankText = "";

      if (rand < 1) {
        prize = 10000;
        rankText = "👑 1등 잭팟 대박 당첨!! (+10,000 P)";
      } else if (rand < 6) {
        prize = 2000;
        rankText = "🥇 2등 당첨! (+2,000 P)";
      } else if (rand < 26) {
        prize = 1000;
        rankText = "🥈 3등 당첨! (+1,000 P)";
      } else if (rand < 56) {
        prize = 500;
        rankText = "🥉 4등 당첨! (본전 500 P 환급)";
      } else {
        prize = 0;
        rankText = "꽝! 아쉽게도 다음 기회에...";
      }

      user.points += prize;
      const data = StorageManager.getGuildData(interaction.guild.id);
      data.points[interaction.user.id] = user;
      StorageManager.saveGuildData(data);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 🎟️ 즉석 스크래치 복권 결과\n• **추첨 결과:** **${rankText}**\n• **현재 잔액:** **${user.points.toLocaleString()} P**`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("한 번 더 긁기 (500P)", "lottery_buy_again")
          ),
        ],
        prize > 500 ? 0x57f287 : prize > 0 ? 0xfee75c : 0xed4245
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 69. /포인트관리 (!!)
  {
    data: new SlashCommandBuilder()
      .setName("포인트관리")
      .setDescription("멤버의 포인트를 지급, 차감 또는 초기화합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) =>
        opt
          .setName("동작")
          .setDescription("수행할 작업 선택")
          .setRequired(true)
          .addChoices(
            { name: "지급 (Add)", value: "add" },
            { name: "차감 (Remove)", value: "remove" },
            { name: "설정 (Set)", value: "set" },
            { name: "초기화 (Reset)", value: "reset" }
          )
      )
      .addUserOption((opt) => opt.setName("멤버").setDescription("대상 멤버").setRequired(true))
      .addIntegerOption((opt) => opt.setName("수량").setDescription("포인트 수량")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const action = interaction.options.getString("동작", true);
      const target = interaction.options.getUser("멤버", true);
      const amount = interaction.options.getInteger("수량") || 0;

      const user = PointsService.getUserRecord(interaction.guild.id, target.id);
      const oldPoints = user.points;

      if (action === "add") {
        user.points += amount;
      } else if (action === "remove") {
        user.points = Math.max(0, user.points - amount);
      } else if (action === "set") {
        user.points = Math.max(0, amount);
      } else if (action === "reset") {
        user.points = 0;
      }

      const data = StorageManager.getGuildData(interaction.guild.id);
      data.points[target.id] = user;
      StorageManager.saveGuildData(data);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 포인트 관리 완료\n• **대상:** <@${target.id}>\n• **동작:** ${action}\n• **이전 잔액:** ${oldPoints.toLocaleString()} P\n• **변경 후 잔액:** **${user.points.toLocaleString()} P**`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },
];
