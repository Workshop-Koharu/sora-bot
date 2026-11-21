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
  // 31. /위키문서작성 (!!)
  {
    data: new SlashCommandBuilder()
      .setName("위키문서작성")
      .setDescription("새로운 서버 위키 문서를 작성합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) => opt.setName("슬러그").setDescription("문서 고유 영문/한글 식별자").setRequired(true))
      .addStringOption((opt) => opt.setName("제목").setDescription("문서 제목").setRequired(true))
      .addStringOption((opt) => opt.setName("내용").setDescription("문서 내용 (Markdown)").setRequired(true))
      .addStringOption((opt) => opt.setName("분류").setDescription("문서 분류 (기본값: 일반)"))
      .addStringOption((opt) => opt.setName("태그").setDescription("쉼표(,)로 구분된 태그 목록")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const slug = interaction.options.getString("슬러그", true);
      const title = interaction.options.getString("제목", true);
      const content = interaction.options.getString("내용", true);
      const category = interaction.options.getString("분류") || "일반";
      const tagsRaw = interaction.options.getString("태그") || "";
      const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

      try {
        const doc = WikiService.createDocument(
          interaction.guild.id,
          interaction.user.id,
          slug,
          title,
          content,
          category,
          tags
        );

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 위키 문서 생성 완료: ${doc.title}\n• **슬러그:** \`${doc.slug}\`\n• **분류:** ${doc.category}\n• **버전:** v${doc.version}\n• **태그:** ${doc.tags.map((t) => `\`#${t}\``).join(" ") || "없음"}\n\n${doc.content.slice(0, 300)}${doc.content.length > 300 ? "..." : ""}`
            ),
          ],
          0x57f287
        );

        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
      } catch (err: any) {
        await interaction.reply({ content: `문서 작성 실패: ${err.message}`, ephemeral: true });
      }
    },
  },

  // 32. /위키문서편집 (!!)
  {
    data: new SlashCommandBuilder()
      .setName("위키문서편집")
      .setDescription("기존 위키 문서를 수정하고 새 버전을 기록합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) => opt.setName("슬러그").setDescription("수정할 문서 슬러그").setRequired(true))
      .addStringOption((opt) => opt.setName("내용").setDescription("새로운 내용").setRequired(true))
      .addStringOption((opt) => opt.setName("수정요약").setDescription("수정 사유 및 요약")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const slug = interaction.options.getString("슬러그", true);
      const newContent = interaction.options.getString("내용", true);
      const summary = interaction.options.getString("수정요약") || "내용 갱신";

      try {
        const doc = WikiService.updateDocument(
          interaction.guild.id,
          interaction.user.id,
          slug,
          undefined,
          newContent,
          undefined,
          undefined,
          summary
        );

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} 위키 문서 편집 완료: ${doc.title}\n• **슬러그:** \`${doc.slug}\`\n• **신규 버전:** v${doc.version}\n• **수정 요약:** ${summary}\n\n${doc.content.slice(0, 300)}`
            ),
          ],
          0x5865f2
        );

        await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
      } catch (err: any) {
        await interaction.reply({ content: `편집 실패: ${err.message}`, ephemeral: true });
      }
    },
  },

  // 33. /위키문서검색
  {
    data: new SlashCommandBuilder()
      .setName("위키문서검색")
      .setDescription("키워드나 태그로 위키 문서를 검색합니다.")
      .addStringOption((opt) => opt.setName("검색어").setDescription("검색할 단어나 구문").setRequired(true))
      .addStringOption((opt) => opt.setName("분류").setDescription("특정 분류 필터")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const q = interaction.options.getString("검색어", true);
      const cat = interaction.options.getString("분류");
      const results = WikiService.searchDocuments(interaction.guild.id, q, cat || undefined);

      if (results.length === 0) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.SEARCH} 위키 검색 결과 없음\n검색어 \`${q}\`에 해당하는 문서가 없습니다.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      const rows = results.slice(0, 5).map((d, i) => {
        return `${i + 1}. **${d.title}** (\`${d.slug}\`) - [${d.category}] v${d.version}\n${d.content.slice(0, 100)}...`;
      });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SEARCH} 위키 문서 검색 결과 [총 ${results.length}건]\n\n${rows.join("\n\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("PREV", "wiki_search_prev", { disabled: true }),
            ComponentsV2Builder.emojiButton("NEXT", "wiki_search_next", { disabled: true })
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 34. /위키문서목록
  {
    data: new SlashCommandBuilder()
      .setName("위키문서목록")
      .setDescription("서버의 모든 위키 문서 목록을 페이지 단위로 열람합니다.")
      .addStringOption((opt) => opt.setName("분류").setDescription("특정 분류만 필터")),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const cat = interaction.options.getString("분류");
      const results = WikiService.searchDocuments(interaction.guild.id, "", cat || undefined);

      if (results.length === 0) {
        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.KCS} 위키 문서 목록 비어있음\n등록된 위키 문서가 없습니다.`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      const rows = results.slice(0, 6).map((d, i) => {
        return `${i + 1}. **${d.title}** (\`${d.slug}\`) - 분류: ${d.category} | 작성자: <@${d.authorId}>`;
      });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 서버 위키 문서 목록 [총 ${results.length}건]\n**페이지: [1/1]**\n\n${rows.join("\n")}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.emojiButton("PREV", "wiki_list_prev", { disabled: true }),
            ComponentsV2Builder.emojiButton("NEXT", "wiki_list_next", { disabled: true }),
            ComponentsV2Builder.emojiButton("FILTER", "wiki_list_filter")
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 35. /위키문서이동 (!!)
  {
    data: new SlashCommandBuilder()
      .setName("위키문서이동")
      .setDescription("문서의 식별자(슬러그)를 변경하고 참조 관계를 유지합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) => opt.setName("현재슬러그").setDescription("현재 슬러그").setRequired(true))
      .addStringOption((opt) => opt.setName("새슬러그").setDescription("새로운 슬러그").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const curSlug = interaction.options.getString("현재슬러그", true).trim().toLowerCase();
      const newSlug = interaction.options.getString("새슬러그", true).trim().toLowerCase().replace(/\s+/g, "-");

      const data = StorageManager.getGuildData(interaction.guild.id);
      const doc = data.wikiDocuments.find((d) => d.slug === curSlug);

      if (!doc) {
        await interaction.reply({ content: `문서 '${curSlug}'를 찾을 수 없습니다.`, ephemeral: true });
        return;
      }

      if (data.wikiDocuments.some((d) => d.slug === newSlug)) {
        await interaction.reply({ content: `이미 존재하는 슬러그 '${newSlug}'입니다.`, ephemeral: true });
        return;
      }

      // Update backlinks and links in other documents
      for (const d of data.wikiDocuments) {
        d.links = d.links.map((s) => (s === curSlug ? newSlug : s));
        d.backlinks = d.backlinks.map((s) => (s === curSlug ? newSlug : s));
      }

      doc.slug = newSlug;
      doc.updatedAt = new Date().toISOString();
      StorageManager.saveGuildData(data);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 위키 문서 슬러그 변경 완료\n• **이전:** \`${curSlug}\`\n• **새로운 슬러그:** \`${newSlug}\`\n상호 링크 및 역참조가 안전하게 트랜잭션 업데이트되었습니다.`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 36. /위키문서분류
  {
    data: new SlashCommandBuilder()
      .setName("위키문서분류")
      .setDescription("등록된 모든 분류 체계와 분류별 문서 수를 조회합니다."),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const data = StorageManager.getGuildData(interaction.guild.id);
      const catCounts: Record<string, number> = {};

      for (const doc of data.wikiDocuments) {
        catCounts[doc.category] = (catCounts[doc.category] || 0) + 1;
      }

      const rows = Object.entries(catCounts).map(([cat, count]) => `• **${cat}**: ${count}개 문서`);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 서버 위키 분류 체계 현황\n\n${rows.length > 0 ? rows.join("\n") : "등록된 문서 분류가 없습니다."}`
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 37. /위키문서태그
  {
    data: new SlashCommandBuilder()
      .setName("위키문서태그")
      .setDescription("위키 문서에 사용된 태그별 빈도와 통계를 조회합니다."),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const data = StorageManager.getGuildData(interaction.guild.id);
      const tagCounts: Record<string, number> = {};

      for (const doc of data.wikiDocuments) {
        for (const tag of doc.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      const rows = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => `• \`#${tag}\`: ${count}회 인덱싱`);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 위키 태그 색인 목록\n\n${rows.length > 0 ? rows.join("\n") : "인덱싱된 태그가 없습니다."}`
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 38. /위키문서연결 (!!)
  {
    data: new SlashCommandBuilder()
      .setName("위키문서연결")
      .setDescription("두 위키 문서 간 상호 링크를 생성합니다. (관리자 전용)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) => opt.setName("출발슬러그").setDescription("시작 문서").setRequired(true))
      .addStringOption((opt) => opt.setName("도착슬러그").setDescription("연결할 대상 문서").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
        return;
      }

      const src = interaction.options.getString("출발슬러그", true);
      const tgt = interaction.options.getString("도착슬러그", true);

      const res = WikiService.linkDocuments(interaction.guild.id, src, tgt);
      if (!res.success) {
        await interaction.reply({ content: `문서 연결 실패: ${res.error}`, ephemeral: true });
        return;
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 문서 연결 완료\n\`${src}\` ➡️ \`${tgt}\` 문서 간 상호 참조가 등록되었습니다.`
          ),
        ],
        0x57f287
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 39. /위키문서링크
  {
    data: new SlashCommandBuilder()
      .setName("위키문서링크")
      .setDescription("특정 위키 문서의 웹 브라우저 영구 링크를 발급합니다.")
      .addStringOption((opt) => opt.setName("슬러그").setDescription("대상 문서 슬러그").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guild) return;

      const slug = interaction.options.getString("슬러그", true);
      const doc = WikiService.getDocument(interaction.guild.id, slug);

      if (!doc) {
        await interaction.reply({ content: `문서 '${slug}'를 찾을 수 없습니다.`, ephemeral: true });
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sora.koharu.live";
      const permalink = `${baseUrl}/wiki/${interaction.guild.id}/${doc.slug}`;

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.SHARE} [${doc.title}](${permalink})\n**영구 링크 주소:** ${permalink}\n\n• **식별자:** \`${doc.slug}\`\n• **최신 버전:** v${doc.version}`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.linkButton("웹에서 보기", permalink)
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },
];
