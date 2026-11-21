import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { WikiService } from "../services/wiki.js";
import { StorageManager } from "../database/storage.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const wikiCommands = [
  // /위키 [조회 | 작성 | 편집 | 삭제 | 목록 | 검색]
  {
    data: new SlashCommandBuilder()
      .setName("위키")
      .setDescription("서버 지식베이스 위키 백과사전")
      .addSubcommand((sub) =>
        sub
          .setName("조회")
          .setDescription("제목 또는 슬러그로 위키 문서를 열람합니다.")
          .addStringOption((opt) => opt.setName("키워드").setDescription("문서 제목 또는 슬러그").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("작성")
          .setDescription("새로운 위키 문서를 작성합니다. (관리자 전용)")
          .addStringOption((opt) => opt.setName("슬러그").setDescription("문서 영문/한글 식별자").setRequired(true))
          .addStringOption((opt) => opt.setName("제목").setDescription("문서 제목").setRequired(true))
          .addStringOption((opt) => opt.setName("내용").setDescription("문서 본문 내용 (Markdown 지원)").setRequired(true))
          .addStringOption((opt) => opt.setName("분류").setDescription("문서 카테고리 (기본: 일반)"))
      )
      .addSubcommand((sub) =>
        sub
          .setName("편집")
          .setDescription("기존 위키 문서를 수정합니다. (관리자 전용)")
          .addStringOption((opt) => opt.setName("슬러그").setDescription("수정할 문서 슬러그").setRequired(true))
          .addStringOption((opt) => opt.setName("새내용").setDescription("새 본문 내용").setRequired(true))
          .addStringOption((opt) => opt.setName("수회사유").setDescription("수정 사유"))
      )
      .addSubcommand((sub) =>
        sub
          .setName("삭제")
          .setDescription("위키 문서를 삭제합니다. (관리자 전용)")
          .addStringOption((opt) => opt.setName("슬러그").setDescription("삭제할 문서 슬러그").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("목록")
          .setDescription("서버에 등록된 모든 위키 문서 목록을 확인합니다.")
          .addStringOption((opt) => opt.setName("분류").setDescription("특정 카테고리만 필터링"))
      )
      .addSubcommand((sub) =>
        sub
          .setName("검색")
          .setDescription("키워드로 위키 문서를 전문 검색합니다.")
          .addStringOption((opt) => opt.setName("검색어").setDescription("검색할 단어 또는 문장").setRequired(true))
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === "조회") {
        const keyword = interaction.options.getString("키워드", true).trim();
        const doc = WikiService.getDocument(guildId, keyword);

        if (!doc) {
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.EXCLAMATION} 문서를 찾을 수 없습니다.\n\`${keyword}\`에 일치하는 위키 문서가 없습니다. \`/위키 검색\` 또는 \`/위키 목록\`을 확인해 보세요.`
              ),
            ],
            0xed4245
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        const date = new Date(doc.updatedAt).toLocaleDateString("ko-KR");
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 📖 [위키] ${doc.title}\n*분류: \`${doc.category}\` | 최종 수정: ${date} (버전 ${doc.version})*\n\n${doc.content}`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "작성") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
          return;
        }

        const slug = interaction.options.getString("슬러그", true).trim();
        const title = interaction.options.getString("제목", true).trim();
        const content = interaction.options.getString("내용", true);
        const category = interaction.options.getString("분류") || "일반";

        try {
          const doc = WikiService.createDocument(guildId, interaction.user.id, slug, title, content, category, []);
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.CHECK} 위키 문서 작성 완료!\n• **제목:** ${doc.title}\n• **슬러그:** \`${doc.slug}\`\n• **분류:** \`${doc.category}\`\n\n\`/위키 조회 키워드:${doc.slug}\` 명령어로 언제든 열람할 수 있습니다.`
              ),
            ],
            0x57f287
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container));
        } catch (err: any) {
          await interaction.reply({ content: `작성 실패: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (subcommand === "편집") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
          return;
        }

        const slug = interaction.options.getString("슬러그", true).trim();
        const newContent = interaction.options.getString("새내용", true);
        const reason = interaction.options.getString("수회사유") || "내용 갱신";

        try {
          const doc = WikiService.updateDocument(
            guildId,
            interaction.user.id,
            slug,
            undefined,
            newContent,
            undefined,
            undefined,
            reason
          );
          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# ${EMOJI_STRINGS.CHECK} 위키 문서 수정 완료!\n• **문서:** ${doc.title} (\`${doc.slug}\`)\n• **새 버전:** v${doc.version}\n• **사유:** ${reason}`
              ),
            ],
            0x57f287
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container));
        } catch (err: any) {
          await interaction.reply({ content: `수정 실패: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (subcommand === "삭제") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: "관리자 권한이 필요합니다.", ephemeral: true });
          return;
        }

        const slug = interaction.options.getString("슬러그", true).trim();
        const data = StorageManager.getGuildData(guildId);
        const prevCount = data.wikiDocuments.length;
        data.wikiDocuments = data.wikiDocuments.filter((d) => d.slug.toLowerCase() !== slug.toLowerCase());

        if (data.wikiDocuments.length === prevCount) {
          await interaction.reply({ content: `\`${slug}\` 문서를 찾을 수 없습니다.`, ephemeral: true });
          return;
        }

        StorageManager.saveGuildData(data);
        const container = ComponentsV2Builder.container(
          [ComponentsV2Builder.text(`# ${EMOJI_STRINGS.CHECK} \`${slug}\` 위키 문서가 정상 삭제되었습니다.`)],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
        return;
      }

      if (subcommand === "목록") {
        const category = interaction.options.getString("분류");
        const data = StorageManager.getGuildData(guildId);
        const docs = category
          ? data.wikiDocuments.filter((d) => d.category.toLowerCase() === category.toLowerCase())
          : data.wikiDocuments;

        if (docs.length === 0) {
          const container = ComponentsV2Builder.container(
            [ComponentsV2Builder.text(`# ${EMOJI_STRINGS.HELP} 등록된 위키 문서가 없습니다.`)],
            0x747f8d
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        const lines = docs.map((d: any, i: number) => `${i + 1}. **${d.title}** (\`${d.slug}\`) — 분류: \`${d.category}\``);
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 📚 ${interaction.guild.name} 위키 문서 목록 (총 ${docs.length}건)\n${lines.join("\n")}\n\n> \`/위키 조회 키워드:<슬러그>\` 로 문서를 확인하세요.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "검색") {
        const query = interaction.options.getString("검색어", true).trim().toLowerCase();
        const data = StorageManager.getGuildData(guildId);
        const results = data.wikiDocuments.filter(
          (d) =>
            d.title.toLowerCase().includes(query) ||
            d.content.toLowerCase().includes(query) ||
            d.slug.toLowerCase().includes(query)
        );

        if (results.length === 0) {
          const container = ComponentsV2Builder.container(
            [ComponentsV2Builder.text(`# ${EMOJI_STRINGS.HELP} \`${query}\` 검색 결과가 없습니다.`)],
            0x747f8d
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
          return;
        }

        const lines = results.map((d: any, i: number) => `${i + 1}. **${d.title}** (\`${d.slug}\`) — \`${d.category}\``);
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🔍 위키 검색 결과: "${query}" (총 ${results.length}건)\n${lines.join("\n")}`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }
    },
  },
];
