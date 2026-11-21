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

export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName("티켓")
    .setDescription("고객지원 티켓(1:1 문의 채널) 시스템 관리")
    .addSubcommand((sub) =>
      sub
        .setName("패널")
        .setDescription("유저가 티켓을 생성할 수 있는 문의 접수 패널을 전송합니다. (관리자 전용)")
        .addChannelOption((opt) =>
          opt
            .setName("채널")
            .setDescription("패널을 게시할 채널 (기본값: 현재 채널)")
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("설정")
        .setDescription("티켓 생성 카테고리 및 담당자 역할을 설정합니다. (관리자 전용)")
        .addChannelOption((opt) =>
          opt
            .setName("카테고리")
            .setDescription("티켓 채널들이 생성될 카테고리")
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addRoleOption((opt) => opt.setName("담당역할").setDescription("문의를 전담 처리할 운영진 역할"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("닫기")
        .setDescription("현재 열려 있는 티켓 채널을 종료/삭제합니다.")
        .addStringOption((opt) => opt.setName("사유").setDescription("티켓 종료 사유"))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();
    const data = StorageManager.getGuildData(interaction.guild.id);

    if (subcommand === "설정") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
        return;
      }

      const category = interaction.options.getChannel("카테고리");
      const role = interaction.options.getRole("담당역할");

      if (category) data.tickets.categoryId = category.id;
      if (role) data.tickets.supportRoleId = role.id;
      data.tickets.enabled = true;
      StorageManager.saveGuildData(data);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 티켓 설정 완료!\n• **카테고리:** ${data.tickets.categoryId ? `<#${data.tickets.categoryId}>` : "미지정"}\n• **담당 역할:** ${data.tickets.supportRoleId ? `<@&${data.tickets.supportRoleId}>` : "없음"}\n• **상태:** 활성화됨`
          ),
        ],
        0x57f287
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
      return;
    }

    if (subcommand === "패널") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
        return;
      }

      const targetChannel = (interaction.options.getChannel("채널") || interaction.channel) as TextChannel;
      if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.reply({ content: "유효한 텍스트 채널이 아닙니다.", ephemeral: true });
        return;
      }

      data.tickets.channelId = targetChannel.id;
      data.tickets.enabled = true;
      StorageManager.saveGuildData(data);

      const options = (data.tickets.categories || [
        { id: "general", label: "일반 문의", description: "서버 이용 관련 질문" },
        { id: "report", label: "신고 접수", description: "규칙 위반 및 유저 신고" },
        { id: "partner", label: "제휴 및 건의", description: "서버 제휴 및 개선 의견" },
      ]).map((c) => ({
        label: c.label,
        value: c.id,
        description: c.description,
      }));

      const panelContainer = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# 🎫 ${interaction.guild.name} 1:1 고객지원 센터\n운영진과의 비공개 문의가 필요하신 경우 아래 메뉴에서 해당 유형을 선택해 주세요.\n선택 시 본인과 담당 운영진만 접근 가능한 전용 비공개 채널이 즉시 생성됩니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.stringSelect("ticket_open_select", options, "문의 유형을 선택하세요")
          ),
        ],
        0x5865f2
      );

      await targetChannel.send(ComponentsV2Builder.formatMessage(panelContainer));
      await interaction.reply({ content: `<#${targetChannel.id}> 채널에 티켓 패널을 전송했습니다.`, ephemeral: true });
      return;
    }

    if (subcommand === "닫기") {
      const channel = interaction.channel as TextChannel;
      const isTicket = channel && channel.name.startsWith("ticket-");

      if (!isTicket) {
        await interaction.reply({ content: "이 명령어는 생성된 티켓 채널 내에서만 사용할 수 있습니다.", ephemeral: true });
        return;
      }

      const reason = interaction.options.getString("사유") || "문의 완료";

      await interaction.reply({
        content: `티켓이 5초 후 종료 및 삭제됩니다. (사유: ${reason})`,
      });

      setTimeout(async () => {
        try {
          await channel.delete(`티켓 종료: ${interaction.user.tag}`);
        } catch {}
      }, 5000);
      return;
    }
  },
};
