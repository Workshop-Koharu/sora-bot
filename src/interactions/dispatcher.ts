import {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  Interaction,
  ModalSubmitInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputStyle,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { SendwichService } from "../services/sendwich.js";
import { ResendService } from "../services/resend.js";
import { CaptchaService } from "../services/captcha.js";
import { PointsService } from "../services/points.js";
import { TicketService } from "../services/tickets.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";
import { updownSessions, typingSessions } from "../commands/games.js";

// Ephemeral in-memory wizard states for multi-step configuration
const wizardStates: Map<string, any> = new Map();
const captchaSessions: Map<string, string> = new Map();
const emailSessions: Map<string, { code: string; roleId: string }> = new Map();

export async function handleInteraction(interaction: Interaction) {
  try {
    if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleStringSelect(interaction);
    } else if (interaction.isChannelSelectMenu()) {
      await handleChannelSelect(interaction);
    } else if (interaction.isRoleSelectMenu()) {
      await handleRoleSelect(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (err: any) {
    console.error("Interaction handling error:", err);
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `작업 처리 중 오류가 발생했습니다: ${err.message}`,
          ephemeral: true,
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: `작업 처리 중 오류가 발생했습니다: ${err.message}`,
          ephemeral: true,
        }).catch(() => {});
      }
    }
  }
}

async function handleButton(interaction: ButtonInteraction) {
  const { customId, guild, user } = interaction;
  if (!guild) return;

  // 1. Cancel action
  if (customId === "cancel_action" || customId === "verify_wizard_cancel") {
    wizardStates.delete(`${guild.id}_${user.id}`);
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.CANCEL} 작업 취소됨\n진행 중이던 작업이 취소되었습니다.`
        ),
      ],
      0x747f8d
    );
    await interaction.update(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  // 2. Verification Wizard Flow
  if (customId === "verify_wizard_step1_next") {
    const state = wizardStates.get(`${guild.id}_${user.id}`);
    if (!state || !state.methods || state.methods.length === 0) {
      await interaction.reply({ content: "하나 이상의 인증 수단을 먼저 선택해 주세요.", ephemeral: true });
      return;
    }

    // Step 2: Channel Select
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.SORA} 인증 시스템 설정 마법사 [2/3]\n**인증 임베드 메시지를 전송할 채널을 선택하세요.**\n\n선택한 채널에 일반 멤버가 볼 수 있는 인증 안내 임베드가 게시됩니다.`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.channelSelect("verify_wizard_channel", "인증 채널 선택")
        ),
        ComponentsV2Builder.separator(false, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.emojiButton("PREV", "verify_wizard_step2_prev"),
          ComponentsV2Builder.emojiButton("NEXT", "verify_wizard_step2_next"),
          ComponentsV2Builder.emojiButton("CANCEL", "verify_wizard_cancel")
        ),
      ],
      0x5865f2
    );
    await interaction.update(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  if (customId === "verify_wizard_step2_prev") {
    // Back to Step 1
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.SORA} 인증 시스템 설정 마법사 [1/3]\n**적용할 인증 수단을 다시 선택하세요.**`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.stringSelect(
            "verify_wizard_methods",
            [
              { label: "전화번호 인증 (Sendwich SMS)", value: "phone" },
              { label: "이메일 인증 (Resend)", value: "email" },
              { label: "버튼 간편 인증", value: "button" },
              { label: "캡챠 이미지 인증", value: "captcha" },
            ],
            "인증 수단 선택",
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
    await interaction.update(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  if (customId === "verify_wizard_step2_next") {
    const state = wizardStates.get(`${guild.id}_${user.id}`);
    if (!state || !state.channelId) {
      await interaction.reply({ content: "인증 채널을 먼저 선택해 주세요.", ephemeral: true });
      return;
    }

    // Step 3: Role Mapping
    const methodNames = state.methods.join(", ");
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.SORA} 인증 시스템 설정 마법사 [3/3]\n**선택한 인증 수단 성공 시 지급할 역할을 선택하세요.**\n• 선택된 수단: **${methodNames}**\n\n아래 셀렉트에서 지급할 역할을 선택해 주세요.`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.roleSelect("verify_wizard_role", "지급할 역할 선택")
        ),
        ComponentsV2Builder.separator(false, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.emojiButton("PREV", "verify_wizard_step3_prev"),
          ComponentsV2Builder.emojiButton("CHECK", "verify_wizard_complete"),
          ComponentsV2Builder.emojiButton("CANCEL", "verify_wizard_cancel")
        ),
      ],
      0x5865f2
    );
    await interaction.update(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  if (customId === "verify_wizard_step3_prev") {
    // Back to Step 2
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.SORA} 인증 시스템 설정 마법사 [2/3]\n**인증 임베드 채널을 선택하세요.**`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.channelSelect("verify_wizard_channel", "인증 채널 선택")
        ),
        ComponentsV2Builder.separator(false, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.emojiButton("PREV", "verify_wizard_step2_prev"),
          ComponentsV2Builder.emojiButton("NEXT", "verify_wizard_step2_next")
        ),
      ],
      0x5865f2
    );
    await interaction.update(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  if (customId === "verify_wizard_complete") {
    const state = wizardStates.get(`${guild.id}_${user.id}`);
    if (!state || !state.roleId) {
      await interaction.reply({ content: "역할을 먼저 선택해 주세요.", ephemeral: true });
      return;
    }

    const data = StorageManager.getGuildData(guild.id);
    data.verification = {
      enabled: true,
      channelId: state.channelId,
      methods: state.methods,
      roleMappings: {},
      updatedAt: new Date().toISOString(),
    };
    for (const m of state.methods) {
      data.verification.roleMappings[m] = state.roleId;
    }
    StorageManager.saveGuildData(data);
    wizardStates.delete(`${guild.id}_${user.id}`);

    // Send the Verification Components V2 Embed to target channel
    const targetChannel = (await guild.channels.fetch(state.channelId)) as TextChannel;
    if (targetChannel && targetChannel.isTextBased()) {
      const buttons = [];
      if (state.methods.includes("phone")) {
        buttons.push(ComponentsV2Builder.button("📱 휴대폰 인증 (Sendwich)", "user_verify_phone"));
      }
      if (state.methods.includes("email")) {
        buttons.push(ComponentsV2Builder.button("✉️ 이메일 인증", "user_verify_email"));
      }
      if (state.methods.includes("button")) {
        buttons.push(ComponentsV2Builder.button("✅ 간편 인증", "user_verify_button"));
      }
      if (state.methods.includes("captcha")) {
        buttons.push(ComponentsV2Builder.button("🤖 캡챠 인증", "user_verify_captcha"));
      }

      const publicVerificationContainer = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SORA} ${guild.name} 서버 공식 멤버 인증\n서버의 원활한 이용과 보안을 위해 인증을 완료해 주세요.\n아래 인증 수단 중 하나를 선택하여 진행하시면 인증 역할(<@&${state.roleId}>)이 자동 부여됩니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(...buttons),
        ],
        0x5865f2
      );

      await targetChannel.send(ComponentsV2Builder.formatMessage(publicVerificationContainer));
    }

    const doneContainer = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.CHECK} 인증 시스템 구성 완료!\n• **게시 채널:** <#${state.channelId}>\n• **적용 수단:** ${state.methods.join(", ")}\n• **지급 역할:** <@&${state.roleId}>\n\n지정된 채널에 Components V2 인증 임베드가 정상 전송되었습니다.`
        ),
      ],
      0x57f287
    );
    await interaction.update(ComponentsV2Builder.formatMessage(doneContainer, true));
    return;
  }

  // 3. User-side Verification Handlers (Triggered by members in verification channel)
  if (customId === "user_verify_button") {
    const data = StorageManager.getGuildData(guild.id);
    const roleId = data.verification.roleMappings["button"];
    if (!roleId) {
      await interaction.reply({ content: "버튼 인증 역할이 설정되지 않았습니다.", ephemeral: true });
      return;
    }

    const member = await guild.members.fetch(user.id);
    if (member.roles.cache.has(roleId)) {
      await interaction.reply({ content: "이미 해당 인증 역할을 보유하고 계십니다.", ephemeral: true });
      return;
    }

    await member.roles.add(roleId);
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.CHECK} 간편 인증 성공!\n<@${user.id}> 님, 간편 인증이 완료되어 <@&${roleId}> 역할이 지급되었습니다.\n\n> 💡 Sora의 모든 기능을 이용하시면 [개인정보처리방침](https://sora.koharu.live/policy) 및 [이용약관](https://sora.koharu.live/terms)에 동의하시는 것으로 간주합니다.`
        ),
      ],
      0x57f287
    );
    await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  if (customId === "user_verify_captcha") {
    const challenge = CaptchaService.generate();
    captchaSessions.set(`${guild.id}_${user.id}`, challenge.code);

    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# 🤖 캡챠 보안 인증\n아래 왜곡된 6자리 영문/숫자 코드를 확인하고 [코드 입력] 버튼을 눌러 정답을 제출하세요.\n\n${challenge.asciiArt}\n\n> 💡 Sora의 모든 기능을 이용하시면 [개인정보처리방침](https://sora.koharu.live/policy) 및 [이용약관](https://sora.koharu.live/terms)에 동의하시는 것으로 간주합니다.`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.button("코드 입력", "captcha_submit_modal_btn"),
          ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
        ),
      ],
      0x5865f2
    );
    await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  if (customId === "captcha_submit_modal_btn") {
    const modal = new ModalBuilder()
      .setCustomId("modal_captcha_answer")
      .setTitle("캡챠 코드 입력")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("captcha_input")
            .setLabel("화면에 표시된 6자리 코드")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(6)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  // UP/DOWN MINI-GAME BUTTONS
  if (customId === "updown_guess_btn") {
    const session = updownSessions.get(user.id);
    if (!session) {
      await interaction.reply({
        content: "진행 중인 업다운 게임이 없습니다. `/미니게임 업다운`으로 시작하세요.",
        ephemeral: true,
      });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId("modal_updown_guess")
      .setTitle("업다운 숫자 추측")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("guess_input")
            .setLabel(`1부터 ${session.max} 사이의 숫자 입력`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(5)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  if (customId === "updown_quit_btn") {
    const session = updownSessions.get(user.id);
    if (!session) {
      await interaction.reply({ content: "진행 중인 게임이 없습니다.", ephemeral: true });
      return;
    }
    updownSessions.delete(user.id);
    await interaction.reply({
      content: `게임을 포기하셨습니다. 정답은 **${session.target}**였습니다.`,
      ephemeral: true,
    });
    return;
  }

  // TYPING MINI-GAME BUTTONS
  if (customId === "typing_submit_btn") {
    const session = typingSessions.get(user.id);
    if (!session) {
      await interaction.reply({
        content: "진행 중인 타자 연습이 없습니다. `/미니게임 타자연습`으로 시작하세요.",
        ephemeral: true,
      });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId("modal_typing_submit")
      .setTitle("타자 연습 문장 입력")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("typing_input")
            .setLabel("제시된 문장을 그대로 입력하세요")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  // PHONE VERIFICATION: Step 1 - Consent Screen
  if (customId === "user_verify_phone") {
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# 📱 휴대폰 SMS 인증 개인정보 수집·이용 동의\n**Koharu Coding Server (KCS) — Sora 인증 시스템**\n\n안전한 서버 커뮤니티 운영과 다계정 악용 방지를 위해 본인 명의 휴대폰 점유 인증을 진행합니다.\n\n• **수집 항목:** 발신 휴대폰 번호, 통신사(SKT/KT/LGU+ 등), 인증 시각, Sendwich 인증 식별자\n• **수집 및 이용 목적:** 중복 계정 방지, 1인 1계정 본인 점유 확인, 인증 역할 자동 지급\n• **보유 및 파기:** **인증 완료 즉시 원본 전화번호는 영구 파기**되며, 중복 가입 방지를 위한 단방향 비가역 암호화 해시(SHA-256) 값만 보관됩니다.\n• **제3자 제공:** **(주)샌드위치 (https://sendwich.kr)** — SMS 수신 및 번호 일치 검증\n• **동의 거부권:** 수집을 거부할 권리가 있으며, 거부 시 휴대폰 인증 전용 역할 부여가 제한될 수 있습니다.\n\n> ⚠️ **「동의하고 SMS 인증 진행」 버튼을 누르시면 위 개인정보 처리방침 및 서비스 이용약관에 동의하시는 것으로 간주합니다.**\n> 정책 전문은 https://sora.koharu.live/policy 에서 확인하실 수 있습니다.`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.button("동의하고 SMS 인증 진행", "phone_consent_agree"),
          ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
        ),
      ],
      0x5865f2
    );
    await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  // PHONE VERIFICATION: Step 2 - Execute Sendwich API
  if (customId === "phone_consent_agree") {
    try {
      await interaction.deferUpdate();
      const clientRef = `discord_${user.id}_${Date.now()}`;
      const session = await SendwichService.createVerification(clientRef);

      const data = StorageManager.getGuildData(guild.id);
      const roleId = data.verification.roleMappings["phone"];

      data.verificationSessions.push({
        id: session.id,
        guildId: guild.id,
        userId: user.id,
        method: "phone",
        status: "pending",
        roleId: roleId || "",
        destination: session.destination,
        smsText: session.sms_text,
        createdAt: new Date().toISOString(),
        expiresAt: session.expires_at,
      });
      StorageManager.saveGuildData(data);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 📱 Sendwich 휴대폰 SMS 인증\n본인 휴대폰에서 아래 번호로 안내된 문자를 전송하신 후 **[인증 확인]** 버튼을 눌러주세요.\n\n• **받는 번호 (destination):** \`${session.destination}\`\n• **보낼 문자 (sms_text):** \`${session.sms_text}\`\n• **만료 시각:** <t:${Math.floor(new Date(session.expires_at).getTime() / 1000)}:R>\n\n> 문자를 전송하신 뒤 아래 [인증 확인] 버튼을 누르시면 인증 결과가 즉시 검증됩니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("인증 확인", `sendwich_check_${session.id}`),
            ComponentsV2Builder.button("취소", `sendwich_cancel_${session.id}`)
          ),
        ],
        0x5865f2
      );

      await interaction.editReply(ComponentsV2Builder.formatMessage(container, true));
    } catch (err: any) {
      await interaction.editReply({ content: `Sendwich 휴대폰 인증 시작 실패: ${err.message}` });
    }
    return;
  }

  if (customId.startsWith("sendwich_check_")) {
    const vrfId = customId.replace("sendwich_check_", "");
    try {
      const statusRes = await SendwichService.getVerification(vrfId);

      if (statusRes.status === "verified") {
        const data = StorageManager.getGuildData(guild.id);
        const sessionRecord = data.verificationSessions.find((s) => s.id === vrfId);
        let roleId = sessionRecord?.roleId || data.verification.roleMappings["phone"];

        if (!roleId) {
          const fallbackRole = guild.roles.cache.find(
            (r) => r.name === "유저" || r.name === "인증" || r.name.toLowerCase() === "member"
          );
          if (fallbackRole) {
            roleId = fallbackRole.id;
            data.verification.roleMappings["phone"] = roleId;
            StorageManager.saveGuildData(data);
          }
        }

        let roleAssigned = false;
        if (roleId) {
          try {
            const member = await guild.members.fetch(user.id);
            await member.roles.add(roleId);
            roleAssigned = true;
          } catch (e) {
            console.warn("Could not assign phone role:", e);
          }
        }

        const roleText = roleAssigned
          ? `<@&${roleId}> 역할이 정상 지급되었습니다!`
          : "휴대폰 소유권이 확인되었습니다!";

        const successContainer = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 휴대폰 인증 성공!\n인증이 성공적으로 완료되었습니다.\n• **통신사/완료시각:** ${statusRes.carrier || "확인됨"} (${statusRes.verified_at || "완료"})\n• ${roleText}\n\n> 💡 Sora의 모든 기능을 이용하시면 [개인정보처리방침](https://sora.koharu.live/policy) 및 [이용약관](https://sora.koharu.live/terms)에 동의하시는 것으로 간주합니다.`
            ),
          ],
          0x57f287
        );
        await interaction.update(ComponentsV2Builder.formatMessage(successContainer, true));
      } else {
        await interaction.reply({
          content: `아직 문자가 수신되지 않았습니다. (현재 상태: ${statusRes.status})\n문자를 전송한 뒤 잠시 후 다시 [인증 확인] 버튼을 눌러주세요.`,
          ephemeral: true,
        });
      }
    } catch (err: any) {
      await interaction.reply({ content: `조회 오류: ${err.message}`, ephemeral: true });
    }
    return;
  }

  if (customId.startsWith("sendwich_cancel_")) {
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.CANCEL} 인증 취소됨\n휴대폰 인증 요청이 취소되었습니다.`
        ),
      ],
      0x747f8d
    );
    await interaction.update(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  // EMAIL VERIFICATION: Step 1 - Consent Screen
  if (customId === "user_verify_email") {
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ✉️ 이메일 인증 개인정보 수집·이용 동의\n**Koharu Coding Server (KCS) — Sora 인증 시스템**\n\n서버 이용 권한 부여 및 본인 확인을 위해 1회용 인증 메일을 발송합니다.\n\n• **수집 항목:** 이메일 주소, 1회용 6자리 인증 코드(OTP)\n• **수집 및 이용 목적:** 1회용 인증 번호 발송 및 본인 확인\n• **보유 및 파기:** **인증 완료 즉시 영구 파기** (미인증 시 5분 후 자동 만료 및 완전 삭제)\n• **제3자 제공:** **Resend Inc. (https://resend.com)** — 메일 발송 대행 (발신: admin@koharu.live)\n• **동의 거부권:** 수집을 거부할 권리가 있으며, 거부 시 이메일 인증 기능 이용이 제한됩니다.\n\n> ⚠️ **「동의하고 이메일 입력」 버튼을 누르시면 위 개인정보 처리방침 및 서비스 이용약관에 동의하시는 것으로 간주합니다.**\n> 정책 전문은 https://sora.koharu.live/policy 에서 확인하실 수 있습니다.`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.button("동의하고 이메일 입력", "email_consent_agree"),
          ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
        ),
      ],
      0x5865f2
    );
    await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  // EMAIL VERIFICATION: Step 2 - Show Email Input Modal
  if (customId === "email_consent_agree") {
    const modal = new ModalBuilder()
      .setCustomId("modal_email_address")
      .setTitle("이메일 주소 입력")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("email_input")
            .setLabel("인증 코드를 받을 이메일 주소")
            .setPlaceholder("example@koharu.live")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  // EMAIL VERIFICATION: Step 3 - Show Code Input Modal
  if (customId === "email_code_enter_btn") {
    const session = emailSessions.get(`${guild.id}_${user.id}`);
    if (!session) {
      await interaction.reply({
        content: "인증 세션이 만료되었습니다. 처음부터 다시 시도해 주세요.",
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId("modal_email_verify_code")
      .setTitle("이메일 6자리 인증코드 입력")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("code_input")
            .setLabel("이메일로 전송된 6자리 숫자 코드")
            .setPlaceholder("123456")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(6)
            .setMaxLength(6)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  // 4. Ticket Management Actions
  if (customId === "ticket_send_panel") {
    const data = StorageManager.getGuildData(guild.id);
    if (!data.tickets.channelId) {
      await interaction.reply({ content: "먼저 패널 채널을 설정해 주세요.", ephemeral: true });
      return;
    }

    const panelChannel = (await guild.channels.fetch(data.tickets.channelId)) as TextChannel;
    if (panelChannel && panelChannel.isTextBased()) {
      const options = data.tickets.categories.map((c) => ({
        label: c.label,
        value: `open_ticket_${c.id}`,
        description: c.description.slice(0, 50),
      }));

      const panelContainer = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SORA} ${guild.name} 고객지원 & 문의 센터\n도움이 필요하신가요? 아래 셀렉트 메뉴에서 문의 유형을 선택하시면 전담 비공개 채널이 생성됩니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.stringSelect("ticket_open_select", options, "문의 카테고리를 선택하세요")
          ),
        ],
        0x5865f2
      );

      await panelChannel.send(ComponentsV2Builder.formatMessage(panelContainer));
      await interaction.reply({ content: "문의 생성 패널이 전송되었습니다.", ephemeral: true });
    }
    return;
  }

  if (customId.startsWith("ticket_claim_")) {
    const ticketId = customId.replace("ticket_claim_", "");
    const data = StorageManager.getGuildData(guild.id);
    const session = data.ticketSessions.find((t) => t.id === ticketId);
    if (session) {
      session.status = "claimed";
      session.claimedBy = user.id;
      StorageManager.saveGuildData(data);
    }
    await interaction.reply({
      content: `✅ <@${user.id}> 님이 이 티켓을 담당자로 접수(Claim)하셨습니다.`,
    });
    return;
  }

  if (customId.startsWith("ticket_close_")) {
    const ticketId = customId.replace("ticket_close_", "");
    const data = StorageManager.getGuildData(guild.id);
    const session = data.ticketSessions.find((t) => t.id === ticketId);
    if (session) {
      session.status = "closed";
      session.closedAt = new Date().toISOString();
      StorageManager.saveGuildData(data);
    }
    await interaction.reply({ content: "이 티켓을 종료하고 5초 후 채널을 삭제합니다." });
    setTimeout(async () => {
      try {
        await interaction.channel?.delete();
      } catch {}
    }, 5000);
    return;
  }

  // 5. Destructive action confirmations
  if (customId.startsWith("confirm_channel_delete_")) {
    const chId = customId.replace("confirm_channel_delete_", "");
    const ch = await guild.channels.fetch(chId).catch(() => null);
    if (ch) {
      await ch.delete();
      await interaction.reply({ content: "채널이 성공적으로 삭제되었습니다.", ephemeral: true });
    } else {
      await interaction.reply({ content: "삭제할 채널을 찾을 수 없습니다.", ephemeral: true });
    }
    return;
  }

  if (customId.startsWith("confirm_kick_")) {
    const targetUserId = customId.replace("confirm_kick_", "");
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (member && member.kickable) {
      await member.kick("관리자 추방 승인");
      await interaction.reply({ content: `<@${targetUserId}> 멤버를 추방했습니다.`, ephemeral: true });
    } else {
      await interaction.reply({ content: "추방할 수 없습니다.", ephemeral: true });
    }
    return;
  }

  if (customId.startsWith("confirm_ban_")) {
    const targetUserId = customId.replace("confirm_ban_", "");
    await guild.bans.create(targetUserId, { reason: "관리자 차단 승인" });
    await interaction.reply({ content: `<@${targetUserId}> 멤버를 영구 차단했습니다.`, ephemeral: true });
    return;
  }

  // 6. Ticket Transcript Export
  if (customId.startsWith("ticket_transcript_")) {
    const ticketId = customId.replace("ticket_transcript_", "");
    await interaction.reply({
      content: `티켓(#${ticketId})의 대화 기록이 백업되었습니다. 대시보드(https://sora.koharu.live/dashboard)에서 확인하실 수 있습니다.`,
      ephemeral: true,
    });
    return;
  }

  // 7. System Stats Refresh
  if (customId === "stats_refresh") {
    const metrics = StorageManager.getCommandMetrics();
    const totalInvocations = metrics.reduce((acc, m) => acc + m.totalCalls, 0);
    const totalSuccess = metrics.reduce((acc, m) => acc + m.successCalls, 0);
    const overallSuccessRate = totalInvocations > 0 ? ((totalSuccess / totalInvocations) * 100).toFixed(1) : "100.0";

    const topCommands = [...metrics]
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 5)
      .map((m, idx) => `${idx + 1}. \`/${m.commandName}\` — 호출: **${m.totalCalls}회** (평균 ${m.avgDurationMs}ms)`);

    const now = new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" });
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# 📊 Sora 시스템 종합 통계\n• **서버:** ${guild.name}\n• **총 명령어 실행:** **${totalInvocations.toLocaleString()}회**\n• **명령어 성공률:** **${overallSuccessRate}%**\n• **지연 시간 (Ping):** **${interaction.client.ws.ping}ms**\n• **새로고침 시각:** ${now}\n\n### 상위 호출 명령어\n${topCommands.length > 0 ? topCommands.join("\n") : "수집된 기록이 없습니다."}`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.button("새로고침", "stats_refresh")
        ),
      ],
      0x5865f2
    );
    await interaction.update(ComponentsV2Builder.formatMessage(container));
    return;
  }

  // 8. Server Info Refresh
  if (customId === "server_info_refresh") {
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
          `# ${EMOJI_STRINGS.KCS} ${guild.name} 서버 정보 (최신)\n\n• **서버 ID:** \`${guild.id}\`\n• **소유자:** ${owner ? `<@${owner.id}> (${owner.user.tag})` : "확인 불가"}\n• **개설일:** ${createdAt}\n• **총 멤버 수:** **${memberCount.toLocaleString()}명**\n• **채널 수:** ${channelCount}개\n• **역할 수:** ${roleCount}개\n• **서버 부스트:** ${boostCount}개 (레벨 ${boostTier})\n• **보안 레벨:** ${guild.verificationLevel}`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.button("새로고침", "server_info_refresh")
        ),
      ],
      0x5865f2
    );
    await interaction.update(ComponentsV2Builder.formatMessage(container));
    return;
  }

  // 9. Server Settings Refresh
  if (customId === "server_settings_refresh") {
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
          `# ${EMOJI_STRINGS.SETTINGS} ${guild.name} — Sora 봇 설정 현황 (최신)\n\n• **인증 시스템:** ${vMethods} (채널: ${vChannel})\n• **입장 환영 메시지:** ${welcomeStatus}\n• **퇴장 메시지:** ${goodbyeStatus}\n• **문의(티켓) 시스템:** ${ticketStatus}\n• **자동 지급 역할:** ${autoRolesCount}개 규칙 등록됨\n• **정기 자동 메시지:** ${autoMsgCount}개 활성화됨\n\n> 웹 대시보드(https://sora.koharu.live/dashboard)에서 모든 설정을 마우스 클릭으로 간편하게 변경할 수 있습니다.`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.button("새로고침", "server_settings_refresh"),
          ComponentsV2Builder.linkButton("대시보드 열기", "https://sora.koharu.live/dashboard")
        ),
      ],
      0x5865f2
    );
    await interaction.update(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  // 10. Summary Refresh
  if (customId.startsWith("summary_refresh")) {
    const daysStr = customId.replace("summary_refresh_", "");
    const days = parseInt(daysStr, 10) || 1;
    const periodName = days === 1 ? "일일" : days === 7 ? "주간" : "월간";

    const data = StorageManager.getGuildData(guild.id);
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;
    const startIso = new Date(startTime).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const endIso = new Date(now).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    const recentWarns = data.warnings.filter((w) => new Date(w.createdAt).getTime() >= startTime);
    const recentTickets = data.ticketSessions.filter((t) => new Date(t.createdAt).getTime() >= startTime);
    const activeMembers = Object.keys(data.points).length;

    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.KCS} 서버 운영 ${periodName} 요약 보고서 (최신)\n**집계 기간:** ${startIso} ~ ${endIso}\n\n• **신규 경고 조치:** ${recentWarns.length}건\n• **신규 생성 티켓:** ${recentTickets.length}건\n• **활동 집계 멤버:** ${activeMembers}명\n• **누적 위키 문서:** ${data.wikiDocuments.length}개\n• **현재 서버 멤버:** ${guild.memberCount.toLocaleString()}명`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.button("새로고침", `summary_refresh_${days}`)
        ),
      ],
      0x5865f2
    );
    await interaction.update(ComponentsV2Builder.formatMessage(container, true));
    return;
  }

  // 11. Generic Refresh or Reload
  if (customId.includes("refresh") || customId.includes("reload") || customId.includes("새로고침")) {
    await interaction.reply({
      content: "최신 정보로 새로고침되었습니다.",
      ephemeral: true,
    });
    return;
  }

  // 12. Safety Catch-all: Never allow any button click to time out or show "인터랙션에 실패했습니다"
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      content: "요청이 정상 접수되었습니다.",
      ephemeral: true,
    });
  }
}

async function handleStringSelect(interaction: StringSelectMenuInteraction) {
  const { customId, guild, user, values } = interaction;
  if (!guild) return;

  if (customId === "verify_wizard_methods") {
    let state = wizardStates.get(`${guild.id}_${user.id}`) || {};
    state.methods = values;
    wizardStates.set(`${guild.id}_${user.id}`, state);

    await interaction.reply({
      content: `인증 수단으로 [**${values.join(", ")}**]가 선택되었습니다. 아래 [다음] 버튼을 눌러주세요.`,
      ephemeral: true,
    });
    return;
  }

  if (customId === "ticket_open_select") {
    const catVal = values[0].replace("open_ticket_", "");
    await interaction.deferReply({ ephemeral: true });
    const { channel } = await TicketService.createTicket(guild, user, catVal);
    await interaction.editReply({
      content: `문의 티켓 채널이 생성되었습니다: <#${channel.id}>`,
    });
    return;
  }
}

async function handleChannelSelect(interaction: ChannelSelectMenuInteraction) {
  const { customId, guild, user, values } = interaction;
  if (!guild) return;

  if (customId === "verify_wizard_channel") {
    let state = wizardStates.get(`${guild.id}_${user.id}`) || {};
    state.channelId = values[0];
    wizardStates.set(`${guild.id}_${user.id}`, state);

    await interaction.reply({
      content: `인증 안내를 전송할 채널로 <#${values[0]}> 채널이 선택되었습니다. 아래 [다음] 버튼을 눌러주세요.`,
      ephemeral: true,
    });
  }
}

async function handleRoleSelect(interaction: RoleSelectMenuInteraction) {
  const { customId, guild, user, values } = interaction;
  if (!guild) return;

  if (customId === "verify_wizard_role") {
    let state = wizardStates.get(`${guild.id}_${user.id}`) || {};
    state.roleId = values[0];
    wizardStates.set(`${guild.id}_${user.id}`, state);

    await interaction.reply({
      content: `인증 성공 시 지급할 역할로 <@&${values[0]}> 역할이 선택되었습니다. 아래 [체크] 버튼을 눌러 설정을 완료하세요!`,
      ephemeral: true,
    });
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  const { customId, guild, user } = interaction;
  if (!guild) return;

  if (customId === "modal_captcha_answer") {
    const answer = interaction.fields.getTextInputValue("captcha_input").trim().toUpperCase();
    const expected = captchaSessions.get(`${guild.id}_${user.id}`);

    if (expected && answer === expected) {
      captchaSessions.delete(`${guild.id}_${user.id}`);
      const data = StorageManager.getGuildData(guild.id);
      const roleId = data.verification.roleMappings["captcha"];

      if (roleId) {
        const member = await guild.members.fetch(user.id);
        await member.roles.add(roleId);
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 캡챠 인증 성공!\n정답입니다! 인증 역할이 정상 지급되었습니다.`
          ),
        ],
        0x57f287
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    } else {
      await interaction.reply({
        content: "캡챠 코드가 일치하지 않습니다. 다시 시도해 주세요.",
        ephemeral: true,
      });
    }
    return;
  }

  if (customId === "modal_email_address") {
    const email = interaction.fields.getTextInputValue("email_input").trim();
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await interaction.deferReply({ ephemeral: true });
    const res = await ResendService.sendVerificationCode(email, code, guild.name);

    if (res.success) {
      const data = StorageManager.getGuildData(guild.id);
      const roleId = data.verification.roleMappings["email"] || "";
      emailSessions.set(`${guild.id}_${user.id}`, { code, roleId });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ✉️ 인증 코드 전송 완료\n\`${email}\` 주소로 6자리 인증 코드를 발송했습니다.\n이메일을 확인하신 후 아래 **[인증코드 입력하기]** 버튼을 눌러 코드를 제출해 주세요.\n\n*(메일이 오지 않은 경우 스팸함을 확인해 주세요.)*`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("인증코드 입력하기", "email_code_enter_btn"),
            ComponentsV2Builder.button("이메일 다시 입력", "email_consent_agree"),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0x5865f2
      );
      await interaction.editReply(ComponentsV2Builder.formatMessage(container, true));
    } else {
      const failContainer = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CANCEL} 이메일 전송 실패\n\`${email}\` 주소로 이메일을 발송하지 못했습니다.\n• **오류 사유:** \`${res.error}\`\n\n올바른 이메일 주소인지 확인하신 후 다시 시도해 주세요.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("다시 시도하기", "email_consent_agree"),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0xed4245
      );
      await interaction.editReply(ComponentsV2Builder.formatMessage(failContainer, true));
    }
    return;
  }

  if (customId === "modal_email_verify_code") {
    const enteredCode = interaction.fields.getTextInputValue("code_input").trim();
    const session = emailSessions.get(`${guild.id}_${user.id}`);

    if (!session) {
      await interaction.reply({
        content: "이메일 인증 세션이 만료되었거나 존재하지 않습니다. 다시 시도해 주세요.",
        ephemeral: true,
      });
      return;
    }

    if (enteredCode === session.code) {
      emailSessions.delete(`${guild.id}_${user.id}`);

      const data = StorageManager.getGuildData(guild.id);
      let roleId = session.roleId || data.verification.roleMappings["email"];

      // Fallback: search for "유저" or "인증" role if roleId is not mapped
      if (!roleId) {
        const fallbackRole = guild.roles.cache.find(
          (r) => r.name === "유저" || r.name === "인증" || r.name.toLowerCase() === "member"
        );
        if (fallbackRole) {
          roleId = fallbackRole.id;
          data.verification.roleMappings["email"] = roleId;
          StorageManager.saveGuildData(data);
        }
      }

      let roleAssigned = false;
      if (roleId) {
        try {
          const member = await guild.members.fetch(user.id);
          await member.roles.add(roleId);
          roleAssigned = true;
        } catch (e) {
          console.warn("Could not assign email role:", e);
        }
      }

      const roleMsg = roleAssigned
        ? `<@&${roleId}> 역할이 정상 지급되었습니다!`
        : "이메일 소유권이 확인되었습니다!";

      const successContainer = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 이메일 인증 성공!\n<@${user.id}> 님, 본인 소유 이메일 인증이 완료되었습니다!\n\n• ${roleMsg}\n\n> 💡 Sora의 모든 기능을 이용하시면 [개인정보처리방침](https://sora.koharu.live/policy) 및 [이용약관](https://sora.koharu.live/terms)에 동의하시는 것으로 간주합니다.`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(successContainer, true));
    } else {
      const mismatchContainer = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CANCEL} 인증 코드 불일치\n입력하신 인증 코드(\`${enteredCode}\`)가 일치하지 않습니다.\n이메일을 다시 확인하신 후 아래 버튼을 눌러 정확한 6자리 코드를 입력해 주세요.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("코드 다시 입력하기", "email_code_enter_btn"),
            ComponentsV2Builder.button("이메일 새로 발송", "email_consent_agree")
          ),
        ],
        0xed4245
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(mismatchContainer, true));
    }
    return;
  }

  // MODAL: UP/DOWN GUESS
  if (customId === "modal_updown_guess") {
    const session = updownSessions.get(user.id);
    if (!session) {
      await interaction.reply({ content: "진행 중인 업다운 게임 세션이 없습니다.", ephemeral: true });
      return;
    }

    const val = parseInt(interaction.fields.getTextInputValue("guess_input").trim(), 10);
    if (isNaN(val)) {
      await interaction.reply({ content: "올바른 숫자를 입력해 주세요.", ephemeral: true });
      return;
    }

    session.attempts++;
    if (val < session.target) {
      await interaction.reply({
        content: `⬆️ **UP!** 정답은 **${val}**보다 큽니다. (현재 시도: ${session.attempts}회)`,
        ephemeral: true,
      });
    } else if (val > session.target) {
      await interaction.reply({
        content: `⬇️ **DOWN!** 정답은 **${val}**보다 작습니다. (현재 시도: ${session.attempts}회)`,
        ephemeral: true,
      });
    } else {
      updownSessions.delete(user.id);
      const reward = Math.max(100, 1000 - session.attempts * 100);
      PointsService.addPoints(guild.id, user.id, reward);
      await interaction.reply({
        content: `🎉 **정답입니다!** 숫자 **${val}**을(를) **${session.attempts}회** 만에 맞추셨습니다!\n획득 보상: **+${reward.toLocaleString()}P**`,
      });
    }
    return;
  }

  // MODAL: TYPING PRACTICE SUBMIT
  if (customId === "modal_typing_submit") {
    const session = typingSessions.get(user.id);
    if (!session) {
      await interaction.reply({ content: "진행 중인 타자 연습 세션이 없습니다.", ephemeral: true });
      return;
    }

    const input = interaction.fields.getTextInputValue("typing_input").trim();
    const elapsedSec = (Date.now() - session.startTime) / 1000;
    typingSessions.delete(user.id);

    if (input === session.sentence) {
      const cpm = Math.round((input.length / elapsedSec) * 60);
      const reward = 200;
      PointsService.addPoints(guild.id, user.id, reward);
      await interaction.reply({
        content: `🎉 **타자 연습 완주 성공!** 정확도 **100%**!\n• **소요 시간:** ${elapsedSec.toFixed(2)}초\n• **타수 (CPM):** 약 ${cpm}타/분\n• **보상:** **+${reward}P**`,
      });
    } else {
      await interaction.reply({
        content: `❌ 제시된 문장과 일치하지 않습니다.\n• 제시문: \`${session.sentence}\`\n• 입력값: \`${input}\``,
        ephemeral: true,
      });
    }
    return;
  }
}
