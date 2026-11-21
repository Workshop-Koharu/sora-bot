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
  // 1. /채널잠금
  {
    data: new SlashCommandBuilder()
      .setName("채널잠금")
      .setDescription("채널의 메시지 전송 권한을 잠그거나 해제합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) =>
        opt
          .setName("동작")
          .setDescription("잠금 또는 해제 선택")
          .setRequired(true)
          .addChoices(
            { name: "잠금", value: "lock" },
            { name: "해제", value: "unlock" }
          )
      )
      .addChannelOption((opt) =>
        opt
          .setName("채널")
          .setDescription("대상 채널 (미지정 시 현재 채널)")
          .addChannelTypes(ChannelType.GuildText)
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const action = interaction.options.getString("동작", true);
      const targetChannel = (interaction.options.getChannel("채널") || interaction.channel) as TextChannel;

      if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: "유효한 텍스트 채널을 찾을 수 없습니다.", ephemeral: true });
        return;
      }

      const everyoneRole = interaction.guild.roles.everyone;
      const currentPermissions = targetChannel.permissionOverwrites.cache.get(everyoneRole.id);
      const isCurrentlyLocked = currentPermissions?.deny.has(PermissionFlagsBits.SendMessages) ?? false;

      if (action === "lock") {
        if (isCurrentlyLocked) {
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.EXCLAMATION} 채널 잠금 실패\n<#${targetChannel.id}> 채널은 **이미 잠금 상태**입니다.`
              ),
            ],
            0xed4245
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        await targetChannel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
        });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 채널 잠금 완료\n<#${targetChannel.id}> 채널이 성공적으로 **잠금**되었습니다.\n일반 멤버의 메시지 전송이 제한됩니다.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
      } else {
        if (!isCurrentlyLocked) {
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.EXCLAMATION} 채널 잠금 해제 실패\n<#${targetChannel.id}> 채널은 **이미 잠금 해제 상태**입니다.`
              ),
            ],
            0xed4245
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        await targetChannel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null,
        });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 채널 잠금 해제 완료\n<#${targetChannel.id}> 채널의 잠금이 성공적으로 **해제**되었습니다.`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
      }
    },
  },

  // 2. /채널삭제
  {
    data: new SlashCommandBuilder()
      .setName("채널삭제")
      .setDescription("지정한 채널을 삭제합니다. (관리자 전용 / 재확인 필수)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((opt) =>
        opt
          .setName("채널")
          .setDescription("삭제할 채널 (미지정 시 현재 채널)")
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const targetChannel = interaction.options.getChannel("채널") || interaction.channel;
      if (!targetChannel) {
        await interaction.reply({ content: "삭제할 대상 채널을 찾을 수 없습니다.", ephemeral: true });
        return;
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.EXCLAMATION} 채널 영구 삭제 확인\n**정말로 이 채널을 삭제하시겠습니까?**\n\n• **대상 채널:** <#${targetChannel.id}> (${(targetChannel as any).name})\n• **영향 범위:** 채널 내 모든 메시지 및 설정 영구 삭제 (복구 불가)\n\n아래 체크 버튼을 누르면 즉시 삭제됩니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CHECK", `confirm_channel_delete_${targetChannel.id}`),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0xed4245
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 3. /채널설정
  {
    data: new SlashCommandBuilder()
      .setName("채널설정")
      .setDescription("채널의 이름 변경 및 역할별 권한을 설정합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((opt) =>
        opt.setName("채널").setDescription("설정할 채널 (미지정 시 현재 채널)")
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const target = (interaction.options.getChannel("채널") || interaction.channel) as TextChannel;
      if (!target) {
        await interaction.reply({ content: "채널을 찾을 수 없습니다.", ephemeral: true });
        return;
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SETTINGS} 채널 상세 설정: #${target.name}\n**대상:** <#${target.id}>\n\n채널 이름을 변경하거나 역할별 권한을 구성할 수 있습니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("채널 이름 변경", `channel_rename_modal_${target.id}`),
            ComponentsV2Builder.button("역할 권한 관리", `channel_permissions_role_${target.id}`)
          ),
          ComponentsV2Builder.separator(false, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },
];
