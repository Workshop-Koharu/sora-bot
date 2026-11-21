import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const serverInfoCommands = [
  // 3. /서버정보
  {
    data: new SlashCommandBuilder()
      .setName("서버정보")
      .setDescription("서버의 상세 정보와 연결된 설정을 조회합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const g = interaction.guild;
      const data = StorageManager.getGuildData(g.id);
      const queryTime = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} ${g.name} 서버 상세 정보\n**조회 기준 시각:** ${queryTime} (KST)\n\n• **서버 ID:** \`${g.id}\`\n• **서버 소유자:** <@${g.ownerId}>\n• **생성 시각:** <t:${Math.floor(g.createdTimestamp / 1000)}:F>\n• **멤버 수:** ${g.memberCount.toLocaleString()}명\n• **채널 수:** ${g.channels.cache.size}개\n• **역할 수:** ${g.roles.cache.size}개\n• **부스트 레벨:** Tier ${g.premiumTier} (${g.premiumSubscriptionCount || 0} 부스트)`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.text(
            `### 연결된 기능 상태\n• **인증 시스템:** ${data.verification.enabled ? "활성화" : "비활성화"}\n• **가입 안내:** ${data.welcome.enabled ? "활성화" : "비활성화"}\n• **퇴장 안내:** ${data.goodbye.enabled ? "활성화" : "비활성화"}\n• **자동 역할:** ${data.autoRoles.length}개 설정됨\n• **문의 티켓:** ${data.tickets.enabled ? "활성화" : "비활성화"}\n• **위키 문서:** ${data.wikiDocuments.length}건 등록됨`
          ),
          ComponentsV2Builder.separator(false, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("SETTINGS", `server_settings_quick_${g.id}`),
            ComponentsV2Builder.emojiButton("RELOAD", `server_info_reload_${g.id}`)
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 4. /서버설정목록
  {
    data: new SlashCommandBuilder()
      .setName("서버설정목록")
      .setDescription("등록된 항목을 조건별로 모아 페이지 단위로 보여줍니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) =>
        opt
          .setName("필터")
          .setDescription("조회할 설정 항목 분류")
          .addChoices(
            { name: "전체", value: "all" },
            { name: "인증", value: "verify" },
            { name: "입퇴장", value: "greet" },
            { name: "자동화", value: "auto" },
            { name: "문의", value: "ticket" }
          )
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const filter = interaction.options.getString("필터") || "all";
      const data = StorageManager.getGuildData(interaction.guild.id);

      const items: string[] = [];
      if (filter === "all" || filter === "verify") {
        items.push(
          `• **[인증]** 상태: \`${data.verification.enabled ? "ON" : "OFF"}\` | 채널: ${data.verification.channelId ? `<#${data.verification.channelId}>` : "미지정"} | 수단: ${data.verification.methods.join(", ") || "없음"}`
        );
      }
      if (filter === "all" || filter === "greet") {
        items.push(
          `• **[가입안내]** 상태: \`${data.welcome.enabled ? "ON" : "OFF"}\` | 채널: ${data.welcome.channelId ? `<#${data.welcome.channelId}>` : "미지정"}`
        );
        items.push(
          `• **[퇴장안내]** 상태: \`${data.goodbye.enabled ? "ON" : "OFF"}\` | 채널: ${data.goodbye.channelId ? `<#${data.goodbye.channelId}>` : "미지정"}`
        );
      }
      if (filter === "all" || filter === "auto") {
        items.push(`• **[자동역할]** 총 ${data.autoRoles.length}개 규칙 등록`);
        items.push(`• **[자동메시지]** 총 ${data.autoMessages.length}개 등록`);
      }
      if (filter === "all" || filter === "ticket") {
        items.push(
          `• **[문의티켓]** 상태: \`${data.tickets.enabled ? "ON" : "OFF"}\` | 카테고리 수: ${data.tickets.categories.length}개`
        );
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SETTINGS} 서버 설정 목록 (필터: ${filter})\n**현재 페이지: [1/1]**\n\n${items.join("\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("PREV", "settings_list_prev", { disabled: true }),
            ComponentsV2Builder.emojiButton("NEXT", "settings_list_next", { disabled: true }),
            ComponentsV2Builder.emojiButton("FILTER", "settings_list_filter_change")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 5. /가입안내설정
  {
    data: new SlashCommandBuilder()
      .setName("가입안내설정")
      .setDescription("새 멤버 가입 시 안내 메시지를 전송할 채널을 설정합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((opt) =>
        opt
          .setName("채널")
          .setDescription("안내 메시지를 보낼 채널")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addBooleanOption((opt) =>
        opt.setName("활성화").setDescription("가입 안내 활성화 여부").setRequired(true)
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const targetChannel = interaction.options.getChannel("채널", true);
      const enabled = interaction.options.getBoolean("활성화", true);
      const data = StorageManager.getGuildData(interaction.guild.id);

      const oldVal = `${data.welcome.enabled ? "ON" : "OFF"} (채널: ${data.welcome.channelId ? `<#${data.welcome.channelId}>` : "없음"})`;
      const newVal = `${enabled ? "ON" : "OFF"} (채널: <#${targetChannel.id}>)`;

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SETTINGS} 가입 안내 설정 확인\n**변경 전 값과 변경 후 값을 비교한 후 확인을 눌러주세요.**\n\n• **현재 값:** ${oldVal}\n• **변경 값:** ${newVal}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CHECK", `confirm_welcome_set_${targetChannel.id}_${enabled ? "1" : "0"}`),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 6. /가입환영문구
  {
    data: new SlashCommandBuilder()
      .setName("가입환영문구")
      .setDescription("새 멤버 가입 시 출력할 문구를 설정합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) =>
        opt
          .setName("문구")
          .setDescription("사용 가능 치환자: {user}, {server}, {count}")
          .setRequired(true)
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const template = interaction.options.getString("문구", true);
      const data = StorageManager.getGuildData(interaction.guild.id);
      const oldTemplate = data.welcome.messageTemplate;

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SETTINGS} 가입 환영 문구 변경 확인\n**현재 값과 변경할 문구를 비교하세요.**\n\n• **현재 문구:**\n\`${oldTemplate}\`\n\n• **변경 문구:**\n\`${template}\``
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CHECK", `confirm_welcome_template_${encodeURIComponent(template.slice(0, 80))}`),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 7. /퇴장안내설정
  {
    data: new SlashCommandBuilder()
      .setName("퇴장안내설정")
      .setDescription("멤버 퇴장 시 안내 메시지를 전송할 채널을 설정합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((opt) =>
        opt.setName("채널").setDescription("퇴장 안내 채널").setRequired(true).addChannelTypes(ChannelType.GuildText)
      )
      .addBooleanOption((opt) =>
        opt.setName("활성화").setDescription("퇴장 안내 활성화 여부").setRequired(true)
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const ch = interaction.options.getChannel("채널", true);
      const enabled = interaction.options.getBoolean("활성화", true);
      const data = StorageManager.getGuildData(interaction.guild.id);

      const oldVal = `${data.goodbye.enabled ? "ON" : "OFF"} (채널: ${data.goodbye.channelId ? `<#${data.goodbye.channelId}>` : "없음"})`;
      const newVal = `${enabled ? "ON" : "OFF"} (채널: <#${ch.id}>)`;

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SETTINGS} 퇴장 안내 설정 확인\n• **현재 값:** ${oldVal}\n• **변경 값:** ${newVal}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("CHECK", `confirm_goodbye_set_${ch.id}_${enabled ? "1" : "0"}`),
            ComponentsV2Builder.emojiButton("CANCEL", "cancel_action")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 8. /멤버정보
  {
    data: new SlashCommandBuilder()
      .setName("멤버정보")
      .setDescription("지정한 멤버의 상세 정보를 조회합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) => opt.setName("멤버").setDescription("조회할 멤버").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser("멤버", true);
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      const queryTime = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      const data = StorageManager.getGuildData(interaction.guild.id);
      const warnings = data.warnings.filter((w) => w.userId === targetUser.id && w.active);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 멤버 정보: ${targetUser.username}\n**조회 기준 시각:** ${queryTime} (KST)\n\n• **ID:** \`${targetUser.id}\`\n• **봇 여부:** ${targetUser.bot ? "봇 (Bot)" : "일반 유저"}\n• **계정 생성일:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>\n• **서버 가입일:** ${member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "알 수 없음"}\n• **누적 활성 경고:** ${warnings.length}회\n• **역할 목록:** ${member ? member.roles.cache.filter((r) => r.id !== interaction.guildId).map((r) => `<@&${r.id}>`).join(" ") || "없음" : "서버 미참여"}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("RELOAD", `member_info_reload_${targetUser.id}`)
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 23. /봇상태
  {
    data: new SlashCommandBuilder()
      .setName("봇상태")
      .setDescription("Sora 봇의 런타임 상태 및 리소스 사용량을 조회합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const mem = process.memoryUsage();
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = uptimeSec % 60;

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SORA} Sora 봇 시스템 상태\n\n• **상태:** 정상 가동 중 (Online)\n• **업타임:** ${hours}시간 ${mins}분 ${secs}초\n• **Node.js 버전:** \`${process.version}\`\n• **메모리(RSS):** ${(mem.rss / 1024 / 1024).toFixed(1)} MB\n• **힙 사용량:** ${(mem.heapUsed / 1024 / 1024).toFixed(1)} / ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB\n• **Gateway 핑:** ${interaction.client.ws.ping}ms\n• **연결된 서버 수:** ${interaction.client.guilds.cache.size}개`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("RELOAD", "bot_status_refresh")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },
];
