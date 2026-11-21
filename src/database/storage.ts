import fs from "node:fs";
import path from "node:path";
import {
  GuildDataStore,
  CommandStatsRecord,
  VerificationSession,
  WarningRecord,
  ModerationAuditRecord,
  WikiDocument,
  UserPointRecord,
} from "../types/index.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const GUILDS_DIR = path.join(DATA_DIR, "guilds");
const GLOBAL_STATS_FILE = path.join(DATA_DIR, "global_stats.json");

// Ensure data directories exist
if (!fs.existsSync(GUILDS_DIR)) {
  fs.mkdirSync(GUILDS_DIR, { recursive: true });
}

export class StorageManager {
  private static cache: Map<string, GuildDataStore> = new Map();
  private static statsCache: Map<string, CommandStatsRecord> = new Map();

  private static getDefaultGuildData(guildId: string): GuildDataStore {
    return {
      guildId,
      verification: {
        enabled: false,
        methods: [],
        roleMappings: {},
        updatedAt: new Date().toISOString(),
      },
      welcome: {
        enabled: false,
        messageTemplate: "환영합니다, {user}님! {server}에 오신 것을 환영해요.",
      },
      goodbye: {
        enabled: false,
        messageTemplate: "{user}님이 서버를 떠나셨습니다.",
      },
      autoRoles: [],
      autoMessages: [],
      tickets: {
        enabled: false,
        categories: [
          { id: "general", label: "일반 문의", description: "서버 이용 관련 일반적인 질문" },
          { id: "report", label: "신고 접수", description: "규칙 위반 유저 또는 악성 행동 신고" },
          { id: "partnership", label: "제휴 문의", description: "서버 제휴 및 협업 문의" },
        ],
      },
      ticketSessions: [],
      warnings: [],
      moderationAudit: [],
      wikiDocuments: [],
      points: {},
      shopItems: [
        { id: "vip_role", guildId, name: "VIP 역할", price: 1000, description: "서버 VIP 전용 역할 부여" },
        { id: "color_role", guildId, name: "색상 변경권", price: 500, description: "원하는 커스텀 색상 역할 지급" },
      ],
      verificationSessions: [],
    };
  }

  /**
   * Get guild data store (partitioned by guildId)
   */
  public static getGuildData(guildId: string): GuildDataStore {
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId)!;
    }

    const filePath = path.join(GUILDS_DIR, `${guildId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const merged = { ...this.getDefaultGuildData(guildId), ...parsed };
        this.cache.set(guildId, merged);
        return merged;
      } catch (err) {
        console.error(`Error reading data for guild ${guildId}:`, err);
      }
    }

    const def = this.getDefaultGuildData(guildId);
    this.saveGuildData(def);
    return def;
  }

  /**
   * Save guild data store atomically
   */
  public static saveGuildData(data: GuildDataStore): void {
    this.cache.set(data.guildId, data);
    const filePath = path.join(GUILDS_DIR, `${data.guildId}.json`);
    const tempPath = `${filePath}.tmp.${Date.now()}`;

    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      console.error(`Failed to atomically save guild data ${data.guildId}:`, err);
    }
  }

  /**
   * Record command execution stats (for developer /명령어통계)
   */
  public static recordCommandMetric(
    commandName: string,
    success: boolean,
    durationMs: number
  ): void {
    this.loadStats();
    let metric = this.statsCache.get(commandName);
    if (!metric) {
      metric = {
        commandName,
        totalCalls: 0,
        successCalls: 0,
        failCalls: 0,
        avgDurationMs: 0,
        lastUsedAt: new Date().toISOString(),
      };
    }

    const newTotal = metric.totalCalls + 1;
    metric.avgDurationMs = Math.round(
      (metric.avgDurationMs * metric.totalCalls + durationMs) / newTotal
    );
    metric.totalCalls = newTotal;
    if (success) {
      metric.successCalls += 1;
    } else {
      metric.failCalls += 1;
    }
    metric.lastUsedAt = new Date().toISOString();

    this.statsCache.set(commandName, metric);
    this.saveStats();
  }

  public static getCommandMetrics(): CommandStatsRecord[] {
    this.loadStats();
    return Array.from(this.statsCache.values());
  }

  private static loadStats(): void {
    if (this.statsCache.size > 0) return;
    if (fs.existsSync(GLOBAL_STATS_FILE)) {
      try {
        const raw = fs.readFileSync(GLOBAL_STATS_FILE, "utf-8");
        const list: CommandStatsRecord[] = JSON.parse(raw);
        for (const item of list) {
          this.statsCache.set(item.commandName, item);
        }
      } catch (err) {
        console.error("Failed to load global command stats:", err);
      }
    }
  }

  private static saveStats(): void {
    const list = Array.from(this.statsCache.values());
    const temp = `${GLOBAL_STATS_FILE}.tmp.${Date.now()}`;
    try {
      fs.writeFileSync(temp, JSON.stringify(list, null, 2), "utf-8");
      fs.renameSync(temp, GLOBAL_STATS_FILE);
    } catch (err) {
      console.error("Failed to save global stats:", err);
    }
  }
}
