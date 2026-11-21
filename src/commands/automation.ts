import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const automationCommands = [
  // 1. /안내 [입장 | 퇴장]
  {
    data: new SlashCommandBuilder()
      .setName("안내")
      .setDescription("멤버 입장/퇴장 메시지 설정 (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) =>
        sub
          .setName("입장")
          .setDescription("신규 멤버 입장 시 환영 메시지를 전송할 채널과 내용을 설정합니다.")
          .addChannelOption((opt) =>
            opt.setName("채널").setDescription("전송할 채널").setRequired(true).addChannelTypes(ChannelType.GuildText)
          )
          .addStringOption((opt) =>
            opt.setName("메시지").setDescription("환영 메시지 내용 ({user}, {server}, {count} 치환 지원)")
          )
          .addBooleanOption((opt) => opt.setName("활성화").setDescription("입장 메시지 사용 여부 (기본: true)"))
      )
      .addSubcommand((sub) =>
        sub
          .setName("퇴장")
          .setDescription("멤버 퇴장 시 안내 메시지를 전송할 채널과 내용을 설정합니다.")
          .addChannelOption((opt) =>
            opt.setName("채널").setDescription("전송할 채널").setRequired(true).addChannelTypes(ChannelType.GuildText)
          )
          .addStringOption((opt) =>
            opt.setName("메시지").setDescription("퇴장 메시지 내용 ({user}, {server}, {count} 치환 지원)")
          )
          .addBooleanOption((opt) => opt.setName("활성화").setDescription("퇴장 메시지 사용 여부 (기본: true)"))
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const channel = interaction.options.getChannel("채널", true);
      const message = interaction.options.getString("메시지");
      const enabled = interaction.options.getBoolean("활성화") ?? true;
      const data = StorageManager.getGuildData(interaction.guild.id);

      if (subcommand === "입장") {
        data.welcome.channelId = channel.id;
        data.welcome.enabled = enabled;
        if (message) data.welcome.messageTemplate = message;
        StorageManager.saveGuildData(data);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 입장 환영 메시지 설정 완료\n• **채널:** <#${channel.id}>\n• **상태:** ${enabled ? "활성화" : "비활성화"}\n• **템플릿:** \`${data.welcome.messageTemplate}\``
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "퇴장") {
        data.goodbye.channelId = channel.id;
        data.goodbye.enabled = enabled;
        if (message) data.goodbye.messageTemplate = message;
        StorageManager.saveGuildData(data);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 퇴장 안내 메시지 설정 완료\n• **채널:** <#${channel.id}>\n• **상태:** ${enabled ? "활성화" : "비활성화"}\n• **템플릿:** \`${data.goodbye.messageTemplate}\``
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }
    },
  },

  // 2. /자동역할 [추가 | 목록 | 삭제]
  {
    data: new SlashCommandBuilder()
      .setName("자동역할")
      .setDescription("신규 멤버 가입 시 자동 지급 역할 관리 (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) =>
        sub
          .setName("추가")
          .setDescription("신규 멤버 대상 자동 지급 규칙을 추가합니다.")
          .addRoleOption((opt) => opt.setName("역할").setDescription("자동 지급할 역할").setRequired(true))
          .addStringOption((opt) =>
            opt
              .setName("대상")
              .setDescription("지급 대상 (일반 유저, 봇, 또는 전체)")
              .addChoices(
                { name: "일반 유저 (사람만)", value: "human" },
                { name: "봇 계정만", value: "bot" },
                { name: "모두 (유저 + 봇)", value: "all" }
              )
          )
      )
      .addSubcommand((sub) => sub.setName("목록").setDescription("현재 등록된 자동 역할 목록을 확인합니다."))
      .addSubcommand((sub) =>
        sub
          .setName("삭제")
          .setDescription("지정한 자동 역할 규칙을 삭제합니다.")
          .addRoleOption((opt) => opt.setName("역할").setDescription("삭제할 역할").setRequired(true))
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const data = StorageManager.getGuildData(interaction.guild.id);

      if (subcommand === "추가") {
        const role = interaction.options.getRole("역할", true);
        const target = (interaction.options.getString("대상") || "all") as "human" | "bot" | "all";

        const exists = data.autoRoles.find((r) => r.roleId === role.id && r.target === target);
        if (exists) {
          await interaction.reply({ content: "이미 동일한 역할 및 대상 규칙이 등록되어 있습니다.", ephemeral: true });
          return;
        }

        data.autoRoles.push({
          id: `autorole_${Date.now()}`,
          roleId: role.id,
          roleName: role.name,
          target,
          createdAt: new Date().toISOString(),
        });
        StorageManager.saveGuildData(data);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 자동 역할 추가 완료\n• **역할:** <@&${role.id}>\n• **지급 대상:** ${target === "human" ? "일반 유저" : target === "bot" ? "봇 계정" : "모든 멤버"}`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "목록") {
        if (data.autoRoles.length === 0) {
          const container = ComponentsV2Builder.container(
            [ComponentsV2Builder.text(`# ${EMOJI_STRINGS.HELP} 등록된 자동 지급 역할 규칙이 없습니다.`)],
            0x747f8d
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        const lines = data.autoRoles.map((r, i) => {
          const targetStr = r.target === "human" ? "일반 유저" : r.target === "bot" ? "봇 계정" : "전체";
          return `${i + 1}. <@&${r.roleId}> (${targetStr})`;
        });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.SETTINGS} 자동 지급 역할 목록 (총 ${data.autoRoles.length}개)\n${lines.join("\n")}`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "삭제") {
        const role = interaction.options.getRole("역할", true);
        const prevLen = data.autoRoles.length;
        data.autoRoles = data.autoRoles.filter((r) => r.roleId !== role.id);

        if (data.autoRoles.length === prevLen) {
          await interaction.reply({ content: "해당 역할에 대한 자동 규칙이 존재하지 않습니다.", ephemeral: true });
          return;
        }

        StorageManager.saveGuildData(data);
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 자동 역할 규칙 삭제 완료\n<@&${role.id}> 역할에 대한 규칙이 제거되었습니다.`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }
    },
  },

  // 3. /자동메시지 [추가 | 목록 | 삭제]
  {
    data: new SlashCommandBuilder()
      .setName("자동메시지")
      .setDescription("주기적 자동 공지/안내 메시지 관리 (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) =>
        sub
          .setName("추가")
          .setDescription("일정 간격으로 채널에 자동 전송할 메시지를 등록합니다.")
          .addChannelOption((opt) =>
            opt.setName("채널").setDescription("전송할 채널").setRequired(true).addChannelTypes(ChannelType.GuildText)
          )
          .addIntegerOption((opt) =>
            opt.setName("간격").setDescription("전송 주기 (분 단위, 최소 10분)").setRequired(true).setMinValue(10)
          )
          .addStringOption((opt) => opt.setName("내용").setDescription("전송할 메시지 본문").setRequired(true))
      )
      .addSubcommand((sub) => sub.setName("목록").setDescription("현재 등록된 자동 메시지 목록을 확인합니다."))
      .addSubcommand((sub) =>
        sub
          .setName("삭제")
          .setDescription("등록된 자동 메시지 ID를 지정하여 삭제합니다.")
          .addStringOption((opt) => opt.setName("메시지id").setDescription("삭제할 메시지 ID").setRequired(true))
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const data = StorageManager.getGuildData(interaction.guild.id);

      if (subcommand === "추가") {
        const channel = interaction.options.getChannel("채널", true);
        const interval = interaction.options.getInteger("간격", true);
        const content = interaction.options.getString("내용", true);

        const newId = `msg_${Date.now()}`;
        data.autoMessages.push({
          id: newId,
          channelId: channel.id,
          content,
          intervalMinutes: interval,
          enabled: true,
        });
        StorageManager.saveGuildData(data);

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 자동 메시지 등록 완료\n• **ID:** \`${newId}\`\n• **채널:** <#${channel.id}>\n• **주기:** ${interval}분마다\n• **내용:** ${content}`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "목록") {
        if (data.autoMessages.length === 0) {
          const container = ComponentsV2Builder.container(
            [ComponentsV2Builder.text(`# ${EMOJI_STRINGS.HELP} 등록된 자동 메시지가 없습니다.`)],
            0x747f8d
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        const lines = data.autoMessages.map((m, i) => {
          return `${i + 1}. \`${m.id}\` <#${m.channelId}> (${m.intervalMinutes}분 주기) - "${m.content.slice(0, 30)}..."`;
        });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.SETTINGS} 등록된 자동 메시지 목록 (총 ${data.autoMessages.length}개)\n${lines.join("\n")}`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "삭제") {
        const msgId = interaction.options.getString("메시지id", true).trim();
        const prevLen = data.autoMessages.length;
        data.autoMessages = data.autoMessages.filter((m) => m.id !== msgId);

        if (data.autoMessages.length === prevLen) {
          await interaction.reply({ content: "해당 ID의 자동 메시지를 찾을 수 없습니다.", ephemeral: true });
          return;
        }

        StorageManager.saveGuildData(data);
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 자동 메시지 삭제 완료\n메시지 ID \`${msgId}\`가 정상 삭제되었습니다.`
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }
    },
  },
];
