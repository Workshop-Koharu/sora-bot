import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const verificationCommand = {
  data: new SlashCommandBuilder()
    .setName("인증구성")
    .setDescription("서버 인증 시스템을 단계별로 구성합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "서버 내에서만 실행 가능한 명령어입니다.",
        ephemeral: true,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "이 명령어를 실행할 관리자 권한이 부족합니다.",
        ephemeral: true,
      });
      return;
    }

    const data = StorageManager.getGuildData(interaction.guildId);

    // Step 1: Select Verification Methods
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
  },
};
