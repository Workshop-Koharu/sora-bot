import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

// High quality animated wheel GIF hosted / cdn url
const ROULETTE_GIF_URL = "https://raw.githubusercontent.com/Workshop-Koharu/SnapBot/main/public/assets/roulette-spin.gif";

export const gamesCommands = [
  // 56. /랜덤추첨
  {
    data: new SlashCommandBuilder()
      .setName("랜덤추첨")
      .setDescription("후보 목록이나 지정 역할 멤버 중 중복 없이 당첨자를 추첨합니다.")
      .addStringOption((opt) => opt.setName("후보").setDescription("쉼표(,)로 구분된 후보 목록"))
      .addRoleOption((opt) => opt.setName("역할").setDescription("해당 역할을 가진 멤버들 중에서 추첨"))
      .addIntegerOption((opt) => opt.setName("당첨수").setDescription("추첨할 인원 수 (기본: 1명)").setMinValue(1)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const candidatesStr = interaction.options.getString("후보");
      const targetRole = interaction.options.getRole("역할");
      const count = interaction.options.getInteger("당첨수") || 1;

      let candidateList: string[] = [];
      if (targetRole) {
        const members = await interaction.guild.members.fetch();
        const roleMembers = members.filter((m) => m.roles.cache.has(targetRole.id) && !m.user.bot);
        candidateList = roleMembers.map((m) => `<@${m.id}>`);
      } else if (candidatesStr) {
        candidateList = candidatesStr.split(",").map((c) => c.trim()).filter(Boolean);
      }

      if (candidateList.length === 0) {
        await interaction.reply({ content: "추첨할 후보 목록이나 역할을 지정해 주세요.", ephemeral: true });
        return;
      }

      if (count > candidateList.length) {
        await interaction.reply({ content: `당첨 인원 수(${count})가 전체 후보 수(${candidateList.length})보다 많습니다.`, ephemeral: true });
        return;
      }

      // Shuffle using Fisher-Yates
      const shuffled = [...candidateList];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const winners = shuffled.slice(0, count);

      // Components V2 container with animated Media Gallery
      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 🎡 실시간 룰렛 랜덤 추첨 완료!\n**총 후보:** ${candidateList.length}명 | **당첨자:** ${count}명\n\n### 🎉 축하합니다! 당첨 결과\n${winners.map((w, idx) => `**${idx + 1}등:** ${w}`).join("\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.mediaGallery([
            {
              url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
              description: "Roulette Wheel Spinning",
            },
          ]),
          ComponentsV2Builder.separator(false, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("RELOAD", `roulette_retry_${count}`)
          ),
        ],
        0xfee75c
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 57. /업다운
  {
    data: new SlashCommandBuilder()
      .setName("업다운")
      .setDescription("1부터 100 사이의 숫자를 맞추는 업다운 미니게임")
      .addIntegerOption((opt) => opt.setName("최대범위").setDescription("숫자 범위 (기본: 100)").setMinValue(10).setMaxValue(1000)),

    async execute(interaction: ChatInputCommandInteraction) {
      const max = interaction.options.getInteger("최대범위") || 100;
      const targetNumber = Math.floor(Math.random() * max) + 1;
      const gameId = `updown_${interaction.user.id}_${Date.now()}`;

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 🎯 업다운 숫자 추측 게임 시작!\n<@${interaction.user.id}> 님, 제가 **1부터 ${max} 사이의 숫자**를 하나 정했습니다.\n\n아래 버튼을 눌러 숫자를 추측해 보세요!`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("숫자 입력하기", `updown_guess_${targetNumber}_${max}_0`),
            ComponentsV2Builder.button("포기하기", `updown_giveup_${targetNumber}`)
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 58. /타자연습
  {
    data: new SlashCommandBuilder()
      .setName("타자연습")
      .setDescription("랜덤 한국어 문장을 제한 시간 내에 빠르게 입력하는 타자 속도 연습"),

    async execute(interaction: ChatInputCommandInteraction) {
      const sampleSentences = [
        "간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다.",
        "내가 그린 기린 그림은 잘 그린 기린 그림이고 네가 그린 기린 그림은 못 그린 기린 그림이다.",
        "저기 계신 저 분이 박 법학박사이시고 여기 계신 이 분이 백 법학박사이시다.",
        "코하루 코딩 서버에서 함께 성장하는 즐거운 디스코드 커뮤니티!",
        "TypeScript와 Discord.js를 활용하여 완성도 높은 봇 서비스를 개발합니다.",
      ];

      const selected = sampleSentences[Math.floor(Math.random() * sampleSentences.length)];
      const startTime = Date.now();

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ⌨️ 타자 연습 챌린지\n아래 제시된 문장을 정확하고 빠르게 입력하세요!\n\n> **${selected}**\n\n준비되셨으면 아래 입력 버튼을 눌러 제출하세요.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("문장 입력하기", `typing_submit_${encodeURIComponent(selected)}_${startTime}`)
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },
];
