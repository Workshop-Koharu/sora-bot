import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

function buildSummary(
  interaction: ChatInputCommandInteraction,
  periodName: "일일" | "주간" | "월간",
  days: number
) {
  const data = StorageManager.getGuildData(interaction.guildId!);
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;
  const startIso = new Date(startTime).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const endIso = new Date(now).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  const recentWarns = data.warnings.filter((w) => new Date(w.createdAt).getTime() >= startTime);
  const recentTickets = data.ticketSessions.filter((t) => new Date(t.createdAt).getTime() >= startTime);
  const activeMembers = Object.keys(data.points).length;

  return ComponentsV2Builder.container(
    [
      ComponentsV2Builder.text(
        `# ${EMOJI_STRINGS.KCS} 서버 운영 ${periodName} 요약 보고서\n**집계 기간:** ${startIso} ~ ${endIso}\n**기준:** 서버 내 주요 운영 로그 및 지표 집계\n\n• **신규 경고 조치:** ${recentWarns.length}건\n• **신규 생성 티켓:** ${recentTickets.length}건\n• **활동 집계 멤버:** ${activeMembers}명\n• **누적 위키 문서:** ${data.wikiDocuments.length}개\n• **현재 서버 멤버:** ${interaction.guild?.memberCount.toLocaleString()}명`
      ),
      ComponentsV2Builder.separator(true, 1),
      ComponentsV2Builder.actionRow(
        ComponentsV2Builder.emojiButton("SEARCH", `summary_detail_audit_${days}`),
        ComponentsV2Builder.emojiButton("SHARE", `summary_export_${days}`)
      ),
    ],
    0x5865f2
  );
}

export const summaryCommands = [
  // 19. /일일요약
  {
    data: new SlashCommandBuilder()
      .setName("일일요약")
      .setDescription("최근 24시간 동안의 핵심 운영 지표 요약을 조회합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }
      const container = buildSummary(interaction, "일일", 1);
      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 20. /주간요약
  {
    data: new SlashCommandBuilder()
      .setName("주간요약")
      .setDescription("최근 7일 동안의 핵심 운영 지표 요약을 조회합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }
      const container = buildSummary(interaction, "주간", 7);
      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 21. /월간요약
  {
    data: new SlashCommandBuilder()
      .setName("월간요약")
      .setDescription("최근 30일 동안의 핵심 운영 지표 요약을 조회합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }
      const container = buildSummary(interaction, "월간", 30);
      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },
];
