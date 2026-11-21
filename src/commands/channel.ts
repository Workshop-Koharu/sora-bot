import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
  TextChannel,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const channelCommands = [
  // /채널 [잠금 | 느린모드]
  {
    data: new SlashCommandBuilder()
      .setName("채널")
      .setDescription("채널 상태 및 권한 제어 (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addSubcommand((sub) =>
        sub
          .setName("잠금")
          .setDescription("채널의 일반 멤버 메시지 전송을 잠그거나 해제합니다.")
          .addBooleanOption((opt) => opt.setName("잠금여부").setDescription("true: 잠금, false: 잠금 해제").setRequired(true))
          .addChannelOption((opt) =>
            opt.setName("채널").setDescription("대상 채널 (미지정 시 현재 채널)").addChannelTypes(ChannelType.GuildText)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("느린모드")
          .setDescription("채널 슬로우모드(메시지 전송 딜레이)를 설정합니다.")
          .addIntegerOption((opt) =>
            opt.setName("초").setDescription("지연 시간 (0 = 해제, 최대 21600초)").setRequired(true).setMinValue(0).setMaxValue(21600)
          )
          .addChannelOption((opt) =>
            opt.setName("채널").setDescription("대상 채널 (미지정 시 현재 채널)").addChannelTypes(ChannelType.GuildText)
          )
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "채널 관리 권한이 필요합니다.", ephemeral: true });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const targetChannel = (interaction.options.getChannel("채널") || interaction.channel) as TextChannel;

      if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: "유효한 텍스트 채널이 아닙니다.", ephemeral: true });
        return;
      }

      if (subcommand === "잠금") {
        const shouldLock = interaction.options.getBoolean("잠금여부", true);
        const everyoneRole = interaction.guild.roles.everyone;

        try {
          await targetChannel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: shouldLock ? false : null,
          });

          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${shouldLock ? EMOJI_STRINGS.EXCLAMATION : EMOJI_STRINGS.CHECK} 채널 ${shouldLock ? "잠금 완료" : "잠금 해제 완료"}\n<#${targetChannel.id}> 채널의 일반 멤버 채팅이 ${shouldLock ? "**잠금(금지)**" : "**해제(허용)**"}되었습니다.`
              ),
            ],
            shouldLock ? 0xed4245 : 0x57f287
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        } catch (err: any) {
          await interaction.reply({ content: `채널 잠금 처리 실패: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (subcommand === "느린모드") {
        const seconds = interaction.options.getInteger("초", true);
        try {
          await targetChannel.setRateLimitPerUser(seconds);
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.CHECK} 슬로우모드 설정 완료\n<#${targetChannel.id}> 채널의 슬로우모드가 **${seconds === 0 ? "해제" : `${seconds}초`}**로 설정되었습니다.`
              ),
            ],
            0x57f287
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        } catch (err: any) {
          await interaction.reply({ content: `슬로우모드 설정 실패: ${err.message}`, ephemeral: true });
        }
        return;
      }
    },
  },
];
