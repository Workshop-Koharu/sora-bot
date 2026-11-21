import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
  TextChannel,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const verificationCommand = {
  data: new SlashCommandBuilder()
    .setName("인증")
    .setDescription("서버 인증 시스템 관리 (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("패널")
        .setDescription("인증 안내 및 버튼이 포함된 패널을 지정 채널에 전송합니다.")
        .addChannelOption((opt) =>
          opt
            .setName("채널")
            .setDescription("패널을 전송할 채널 (기본: 현재 채널)")
            .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption((opt) => opt.setName("인증역할").setDescription("인증 완료 시 지급할 역할"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("설정")
        .setDescription("단계별 마법사를 통해 수단(휴대폰/이메일/버튼/캡챠)과 역할을 설정합니다.")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "서버 내에서만 실행할 수 있습니다.", ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const data = StorageManager.getGuildData(interaction.guildId);

    if (subcommand === "패널") {
      const targetChannel = (interaction.options.getChannel("채널") || interaction.channel) as TextChannel;
      const role = interaction.options.getRole("인증역할");

      if (role) {
        data.verification.roleMappings["phone"] = role.id;
        data.verification.roleMappings["email"] = role.id;
        data.verification.roleMappings["button"] = role.id;
        data.verification.roleMappings["captcha"] = role.id;
        data.verification.enabled = true;
        data.verification.channelId = targetChannel.id;
        StorageManager.saveGuildData(data);
      }

      const roleId = role?.id || data.verification.roleMappings["phone"] || data.verification.roleMappings["email"] || data.verification.roleMappings["button"];
      const roleText = roleId ? `인증 역할(<@&${roleId}>)이` : "인증 역할이";

      const panelContainer = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} ${interaction.guild.name} 서버 공식 멤버 인증\n서버의 원활한 이용과 보안을 위해 인증을 완료해 주세요.\n아래 인증 수단 중 하나를 선택하여 진행하시면 ${roleText} 자동 부여됩니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("휴대폰 인증 (Sendwich)", "user_verify_phone"),
            ComponentsV2Builder.button("이메일 인증", "user_verify_email")
          ),
        ],
        0x5865f2
      );

      await targetChannel.send(ComponentsV2Builder.formatMessage(panelContainer));
      await interaction.reply({
        content: `<#${targetChannel.id}> 채널에 인증 패널을 전송했습니다.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "설정") {
      // Step 1: Select Verification Methods Wizard
      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SORA} 인증 시스템 설정 마법사 [1/3]\n**적용할 인증 수단을 선택하세요.** (복수 선택 가능)\n\n• **전화번호**: Sendwich SMS 번호 점유 인증\n• **이메일**: Resend 6자리 인증 코드 확인\n• **버튼**: 원클릭 간편 인증\n• **캡챠**: 문자 왜곡 보안 인증`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.stringSelect(
              "verify_wizard_methods",
              [
                { label: "전화번호 인증 (Sendwich SMS)", value: "phone", description: "SMS 문자 발송 확인" },
                { label: "이메일 인증 (Resend)", value: "email", description: "이메일 인증 코드 입력" },
                { label: "버튼 간편 인증", value: "button", description: "클릭 시 즉시 역할 지급" },
                { label: "캡챠 이미지 인증", value: "captcha", description: "왜곡 문자 입력 확인" },
              ],
              "인증 수단을 선택하세요 (복수 선택 가능)",
              1,
              4
            )
          ),
          ComponentsV2Builder.separator(false, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("NEXT", "verify_wizard_step1_next"),
            ComponentsV2Builder.emojiButton("CANCEL", "verify_wizard_cancel")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
      return;
    }
  },
};
