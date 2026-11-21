import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { DEVELOPER_ID, EMOJI_STRINGS } from "../constants/emojis.js";

export const statsCommand = {
  // 22. /명령어통계 (!!! 개발자 전용)
  data: new SlashCommandBuilder()
    .setName("명령어통계")
    .setDescription("봇 전체 명령어 사용량, 성공률 및 평균 응답 속도 집계 (개발자 전용)"),

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== DEVELOPER_ID) {
      await interaction.reply({
        content: "이 명령어는 Sora 개발자(Developer) 전용 명령어입니다.",
        ephemeral: true,
      });
      return;
    }

    const metrics = StorageManager.getCommandMetrics();
    const queryTime = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    if (metrics.length === 0) {
      const emptyContainer = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SORA} 명령어 통계 시스템\n**조회 시각:** ${queryTime}\n\n현재 수집된 명령어 실행 기록이 없습니다. (미수집 상태)`
          ),
        ],
        0x5865f2
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(emptyContainer, true));
      return;
    }

    const totalInvocations = metrics.reduce((acc, m) => acc + m.totalCalls, 0);
    const totalSuccess = metrics.reduce((acc, m) => acc + m.successCalls, 0);
    const overallSuccessRate = totalInvocations > 0 ? ((totalSuccess / totalInvocations) * 100).toFixed(1) : "0.0";

    const topCommands = [...metrics]
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 8)
      .map((m, idx) => {
        const rate = m.totalCalls > 0 ? ((m.successCalls / m.totalCalls) * 100).toFixed(0) : "0";
        return `${idx + 1}. \`/${m.commandName}\` — 호출: **${m.totalCalls.toLocaleString()}**회 | 성공률: **${rate}%** | 평균: **${m.avgDurationMs}ms**`;
      });

    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.SORA} Sora 전체 명령어 통계 및 분석\n**조회 기준 시각:** ${queryTime} (KST)\n\n• **총 실행 건수:** ${totalInvocations.toLocaleString()}회\n• **전체 성공률:** ${overallSuccessRate}%\n• **모니터링 대상 명령어:** ${metrics.length}개\n\n### 가장 많이 호출된 명령어 TOP 8\n${topCommands.join("\n")}`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.emojiButton("RELOAD", "stats_refresh"),
          ComponentsV2Builder.emojiButton("SHARE", "stats_export_json")
        ),
      ],
      0x5865f2
    );

    await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
  },
};
