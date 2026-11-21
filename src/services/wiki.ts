import { StorageManager } from "../database/storage.js";
import { WikiDocument } from "../types/index.js";

export class WikiService {
  public static getDocument(guildId: string, slug: string): WikiDocument | undefined {
    const data = StorageManager.getGuildData(guildId);
    return data.wikiDocuments.find((d) => d.slug.toLowerCase() === slug.toLowerCase());
  }

  public static createDocument(
    guildId: string,
    authorId: string,
    slug: string,
    title: string,
    content: string,
    category: string,
    tags: string[]
  ): WikiDocument {
    const data = StorageManager.getGuildData(guildId);
    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");

    if (this.getDocument(guildId, cleanSlug)) {
      throw new Error(`이미 존재하는 문서 슬러그입니다: '${cleanSlug}'`);
    }

    const now = new Date().toISOString();
    const doc: WikiDocument = {
      id: `wiki_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      guildId,
      slug: cleanSlug,
      title: title.trim(),
      content: content.trim(),
      category: category.trim() || "일반",
      tags: tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
      version: 1,
      authorId,
      createdAt: now,
      updatedAt: now,
      links: [],
      backlinks: [],
      history: [
        {
          version: 1,
          editorId: authorId,
          updatedAt: now,
          summary: "문서 최초 생성",
        },
      ],
    };

    data.wikiDocuments.push(doc);
    StorageManager.saveGuildData(data);
    return doc;
  }

  public static updateDocument(
    guildId: string,
    editorId: string,
    slug: string,
    title?: string,
    content?: string,
    category?: string,
    tags?: string[],
    summary = "문서 수정"
  ): WikiDocument {
    const data = StorageManager.getGuildData(guildId);
    const idx = data.wikiDocuments.findIndex((d) => d.slug.toLowerCase() === slug.toLowerCase());
    if (idx === -1) {
      throw new Error(`문서를 찾을 수 없습니다: '${slug}'`);
    }

    const current = data.wikiDocuments[idx];
    const newVersion = current.version + 1;
    const now = new Date().toISOString();

    if (title) current.title = title.trim();
    if (content) current.content = content.trim();
    if (category) current.category = category.trim();
    if (tags) current.tags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);

    current.version = newVersion;
    current.updatedAt = now;
    current.history.push({
      version: newVersion,
      editorId,
      updatedAt: now,
      summary,
    });

    data.wikiDocuments[idx] = current;
    StorageManager.saveGuildData(data);
    return current;
  }

  public static linkDocuments(
    guildId: string,
    sourceSlug: string,
    targetSlug: string
  ): { success: boolean; error?: string } {
    if (sourceSlug.toLowerCase() === targetSlug.toLowerCase()) {
      return { success: false, error: "문서 자신을 연결(순환 참조)할 수 없습니다." };
    }

    const data = StorageManager.getGuildData(guildId);
    const source = data.wikiDocuments.find((d) => d.slug.toLowerCase() === sourceSlug.toLowerCase());
    const target = data.wikiDocuments.find((d) => d.slug.toLowerCase() === targetSlug.toLowerCase());

    if (!source || !target) {
      return { success: false, error: "연결할 문서 중 하나 이상을 찾을 수 없습니다." };
    }

    // Check circular references
    if (target.links.includes(source.slug)) {
      return { success: false, error: "양방향 순환 참조가 감지되었습니다." };
    }

    if (!source.links.includes(target.slug)) {
      source.links.push(target.slug);
    }
    if (!target.backlinks.includes(source.slug)) {
      target.backlinks.push(source.slug);
    }

    StorageManager.saveGuildData(data);
    return { success: true };
  }

  public static searchDocuments(
    guildId: string,
    query: string,
    category?: string,
    tag?: string
  ): WikiDocument[] {
    const data = StorageManager.getGuildData(guildId);
    const q = query.toLowerCase().trim();

    return data.wikiDocuments.filter((doc) => {
      const matchQuery =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.content.toLowerCase().includes(q) ||
        doc.slug.toLowerCase().includes(q);

      const matchCat = !category || doc.category.toLowerCase() === category.toLowerCase();
      const matchTag = !tag || doc.tags.some((t) => t.toLowerCase() === tag.toLowerCase());

      return matchQuery && matchCat && matchTag;
    });
  }
}
