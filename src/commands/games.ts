import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { PointsService } from "../services/points.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

// Safe in-memory game state maps (keyed by userId)
export const updownSessions = new Map<
  string,
  { target: number; max: number; attempts: number }
>();

export const typingSessions = new Map<
  string,
  { sentence: string; startTime: number }
>();

const SAMPLE_TYPING_SENTENCES = [
  "코하루 코딩 서버에서 함께 성장하는 디스코드 커뮤니티!",
  "TypeScript와 Discord.js로 안정적인 봇을 개발합니다.",
  "간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다.",
  "내가 그린 기린 그림은 잘 그린 기린 그림이다.",
  "즐거운 디스코드 생활을 위해 규칙을 준수해 주세요.",
];

export const gamesCommands = [
  // /미니게임 [도박 | 복권 | 룰렛 | 업다운 | 타자연습]
  {
    data: new SlashCommandBuilder()
      .setName("미니게임")
      .setDescription("포인트 기반 미니게임 및 엔터테인먼트")
      .addSubcommand((sub) =>
        sub
          .setName("도박")
          .setDescription("주사위를 굴려 승리 시 베팅액의 2배를 획득합니다 (승률 50%).")
          .addIntegerOption((opt) =>
            opt.setName("금액").setDescription("베팅할 포인트").setRequired(true).setMinValue(10)
          )
      )
      .addSubcommand((sub) => sub.setName("복권").setDescription("100P를 사용하여 즉석 복권을 긁습니다."))
      .addSubcommand((sub) =>
        sub
          .setName("룰렛")
          .setDescription("슬롯머신 3칸 룰렛을 돌려 그림을 맞춥니다.")
          .addIntegerOption((opt) =>
            opt.setName("금액").setDescription("베팅할 포인트").setRequired(true).setMinValue(10)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("업다운")
          .setDescription("1부터 지정 숫자 사이의 난수를 맞추는 숫자 추측 게임")
          .addIntegerOption((opt) =>
            opt.setName("최대범위").setDescription("숫자 범위 (기본: 100)").setMinValue(10).setMaxValue(1000)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("타자연습").setDescription("제시된 문장을 빠르게 입력하여 타자 속도를 측정합니다.")
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      if (subcommand === "도박") {
        const bet = interaction.options.getInteger("금액", true);
        const userRec = PointsService.getUserRecord(guildId, userId);

        if (userRec.points < bet) {
          await interaction.reply({
            content: `포인트가 부족합니다. (보유: ${userRec.points.toLocaleString()}P, 베팅: ${bet.toLocaleString()}P)`,
            ephemeral: true,
          });
          return;
        }

        const userRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll = Math.floor(Math.random() * 6) + 1;

        if (userRoll > botRoll) {
          PointsService.addPoints(guildId, userId, bet);
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# 🎲 주사위 도박 — 승리!\n<@${userId}> 님이 봇을 이겼습니다!\n\n• **내 주사위:** 🎲 **${userRoll}**\n• **봇 주사위:** 🎲 **${botRoll}**\n• **획득 보상:** +${bet.toLocaleString()}P\n• **현재 잔액:** **${(userRec.points + bet).toLocaleString()}P**`
              ),
            ],
            0x57f287
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container));
        } else if (userRoll < botRoll) {
          PointsService.addPoints(guildId, userId, -bet);
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# 🎲 주사위 도박 — 패배...\n봇의 주사위가 더 높았습니다.\n\n• **내 주사위:** 🎲 **${userRoll}**\n• **봇 주사위:** 🎲 **${botRoll}**\n• **차감 포인트:** -${bet.toLocaleString()}P\n• **현재 잔액:** **${(userRec.points - bet).toLocaleString()}P**`
              ),
            ],
            0xed4245
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container));
        } else {
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# 🎲 주사위 도박 — 무승부\n둘 다 🎲 **${userRoll}**이 나왔습니다. 베팅액이 그대로 보존됩니다.`
              ),
            ],
            0xfee75c
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container));
        }
        return;
      }

      if (subcommand === "복권") {
        const cost = 100;
        const userRec = PointsService.getUserRecord(guildId, userId);

        if (userRec.points < cost) {
          await interaction.reply({
            content: `복권 구매 포인트(100P)가 부족합니다. (현재 잔액: ${userRec.points.toLocaleString()}P)`,
            ephemeral: true,
          });
          return;
        }

        PointsService.addPoints(guildId, userId, -cost);
        const rand = Math.random() * 100;
        let prize = 0;
        let rankName = "꽝";

        if (rand < 1) {
          prize = 10000;
          rankName = "🥇 1등 (10,000P)";
        } else if (rand < 5) {
          prize = 2000;
          rankName = "🥈 2등 (2,000P)";
        } else if (rand < 20) {
          prize = 500;
          rankName = "🥉 3등 (500P)";
        } else if (rand < 50) {
          prize = 100;
          rankName = "🎟️ 본전 (100P)";
        }

        if (prize > 0) {
          PointsService.addPoints(guildId, userId, prize);
        }

        const newBal = userRec.points - cost + prize;
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🎟️ 즉석 복권 결과: ${rankName}!\n<@${userId}> 님의 복권 당첨 결과입니다.\n\n• **결과:** **${rankName}**\n• **변동:** ${prize >= cost ? `+${(prize - cost).toLocaleString()}` : `-${(cost - prize).toLocaleString()}`}P\n• **현재 잔액:** **${newBal.toLocaleString()}P**`
            ),
          ],
          prize > cost ? 0x57f287 : prize === cost ? 0xfee75c : 0x747f8d
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "룰렛") {
        const bet = interaction.options.getInteger("금액", true);
        const userRec = PointsService.getUserRecord(guildId, userId);

        if (userRec.points < bet) {
          await interaction.reply({
            content: `포인트가 부족합니다. (보유: ${userRec.points.toLocaleString()}P, 베팅: ${bet.toLocaleString()}P)`,
            ephemeral: true,
          });
          return;
        }

        const symbols = ["🍒", "🍋", "🍇", "💎", "7️⃣"];
        const s1 = symbols[Math.floor(Math.random() * symbols.length)];
        const s2 = symbols[Math.floor(Math.random() * symbols.length)];
        const s3 = symbols[Math.floor(Math.random() * symbols.length)];

        let multiplier = 0;
        if (s1 === s2 && s2 === s3) {
          multiplier = s1 === "7️⃣" ? 10 : s1 === "💎" ? 5 : 3;
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
          multiplier = 1.5;
        }

        const profit = Math.floor(bet * multiplier) - bet;
        PointsService.addPoints(guildId, userId, profit);
        const finalBal = userRec.points + profit;

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🎰 슬롯 룰렛 결과\n[ ${s1} | ${s2} | ${s3} ]\n\n• **결과:** ${multiplier > 1 ? `🎉 **${multiplier}배 당첨!** (+${profit.toLocaleString()}P)` : "❌ 아쉽게도 빗나갔습니다."}\n• **현재 잔액:** **${finalBal.toLocaleString()}P**`
            ),
          ],
          multiplier > 1 ? 0x57f287 : 0xed4245
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "업다운") {
        const max = interaction.options.getInteger("최대범위") || 100;
        const target = Math.floor(Math.random() * max) + 1;

        updownSessions.set(userId, { target, max, attempts: 0 });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🎯 업다운 숫자 추측 게임\n<@${userId}> 님, **1부터 ${max} 사이의 숫자**를 정했습니다.\n아래 **[숫자 입력하기]** 버튼을 눌러 추측해 보세요!`
            ),
            ComponentsV2Builder.separator(true, 1),
            ComponentsV2Builder.actionRow(
              ComponentsV2Builder.button("숫자 입력하기", "updown_guess_btn"),
              ComponentsV2Builder.button("포기하기", "updown_quit_btn")
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "타자연습") {
        const sentence = SAMPLE_TYPING_SENTENCES[Math.floor(Math.random() * SAMPLE_TYPING_SENTENCES.length)];
        const startTime = Date.now();

        typingSessions.set(userId, { sentence, startTime });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ⌨️ 타자 연습 챌린지\n아래 문장을 빠르고 정확하게 입력하세요!\n\n> **${sentence}**\n\n준비되셨으면 아래 **[문장 입력하기]** 버튼을 눌러 제출하세요.`
            ),
            ComponentsV2Builder.separator(true, 1),
            ComponentsV2Builder.actionRow(
              ComponentsV2Builder.button("문장 입력하기", "typing_submit_btn")
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }
    },
  },
];
