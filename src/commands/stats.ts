import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("통계")
    .setDescription("Sora 봇 및 서버 통계 지표를 확인합니다.")
    .addSubcommand((sub) => sub.setName("요약").setDescription("서버 명령어 사용량 및 봇 상태 요약")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const metrics = StorageManager.getCommandMetrics();
    const totalInvocations = metrics.reduce((acc, m) => acc + m.totalCalls, 0);
    const totalSuccess = metrics.reduce((acc, m) => acc + m.successCalls, 0);
    const overallSuccessRate = totalInvocations > 0 ? ((totalSuccess / totalInvocations) * 100).toFixed(1) : "100.0";

    const topCommands = [...metrics]
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 5)
      .map((m, idx) => `${idx + 1}. \`/${m.commandName}\` — 호출: **${m.totalCalls}회** (평균 ${m.avgDurationMs}ms)`);

    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# 📊 Sora 시스템 종합 통계\n• **서버:** ${interaction.guild.name}\n• **총 명령어 실행:** **${totalInvocations.toLocaleString()}회**\n• **명령어 성공률:** **${overallSuccessRate}%**\n• **지연 시간 (Ping):** **${interaction.client.ws.ping}ms**\n\n### 상위 호출 명령어\n${topCommands.length > 0 ? topCommands.join("\n") : "수집된 기록이 없습니다."}`
        ),
      ],
      0x5865f2
    );
    await interaction.reply(ComponentsV2Builder.formatMessage(container));
  },
};
