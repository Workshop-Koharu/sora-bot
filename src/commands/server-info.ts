import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const serverInfoCommands = [
  // /서버 [정보 | 설정]
  {
    data: new SlashCommandBuilder()
      .setName("서버")
      .setDescription("서버 정보 및 현재 Sora 봇 설정 상태를 조회합니다.")
      .addSubcommand((sub) =>
        sub.setName("정보").setDescription("현재 서버의 상세 정보 (멤버 수, 부스트, 보안 수준 등)를 확인합니다.")
      )
      .addSubcommand((sub) =>
        sub.setName("설정").setDescription("현재 서버의 Sora 봇 설정 상태 (인증, 환영메시지, 자동역할 등)를 확인합니다.")
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const subcommand = interaction.options.getSubcommand();
      const guild = interaction.guild;

      if (subcommand === "정보") {
        const owner = await guild.fetchOwner().catch(() => null);
        const memberCount = guild.memberCount;
        const channelCount = guild.channels.cache.size;
        const roleCount = guild.roles.cache.size;
        const boostCount = guild.premiumSubscriptionCount || 0;
        const boostTier = guild.premiumTier;
        const createdAt = guild.createdAt.toLocaleDateString("ko-KR");

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.KCS} ${guild.name} 서버 정보\n\n• **서버 ID:** \`${guild.id}\`\n• **소유자:** ${owner ? `<@${owner.id}> (${owner.user.tag})` : "확인 불가"}\n• **개설일:** ${createdAt}\n• **총 멤버 수:** **${memberCount.toLocaleString()}명**\n• **채널 수:** ${channelCount}개\n• **역할 수:** ${roleCount}개\n• **서버 부스트:** ${boostCount}개 (레벨 ${boostTier})\n• **보안 레벨:** ${guild.verificationLevel}`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "설정") {
        const data = StorageManager.getGuildData(guild.id);
        const vMethods = data.verification.methods.length > 0
          ? data.verification.methods.join(", ")
          : "설정되지 않음";
        const vChannel = data.verification.channelId ? `<#${data.verification.channelId}>` : "미지정";
        const welcomeStatus = data.welcome.enabled
          ? `활성화됨 (${data.welcome.channelId ? `<#${data.welcome.channelId}>` : "미지정"})`
          : "비활성화";
        const goodbyeStatus = data.goodbye.enabled
          ? `활성화됨 (${data.goodbye.channelId ? `<#${data.goodbye.channelId}>` : "미지정"})`
          : "비활성화";
        const ticketStatus = data.tickets.enabled
          ? `활성화됨 (카테고리 ${data.tickets.categories.length}개)`
          : "비활성화";
        const autoRolesCount = data.autoRoles.length;
        const autoMsgCount = data.autoMessages.filter((m) => m.enabled).length;

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.SETTINGS} ${guild.name} — Sora 봇 설정 현황\n\n• **인증 시스템:** ${vMethods} (채널: ${vChannel})\n• **입장 환영 메시지:** ${welcomeStatus}\n• **퇴장 메시지:** ${goodbyeStatus}\n• **문의(티켓) 시스템:** ${ticketStatus}\n• **자동 지급 역할:** ${autoRolesCount}개 규칙 등록됨\n• **정기 자동 메시지:** ${autoMsgCount}개 활성화됨\n\n> 웹 대시보드(https://sora.koharu.live/dashboard)에서 모든 설정을 마우스 클릭으로 간편하게 변경할 수 있습니다.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }
    },
  },
];
