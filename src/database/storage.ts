import fs from "node:fs";
import path from "node:path";
import { dbPool } from "./db.js";
import {
  GuildDataStore,
  CommandStatsRecord,
} from "../types/index.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const GUILDS_DIR = path.join(DATA_DIR, "guilds");
const GLOBAL_STATS_FILE = path.join(DATA_DIR, "global_stats.json");

if (!fs.existsSync(GUILDS_DIR)) {
  try {
    fs.mkdirSync(GUILDS_DIR, { recursive: true });
  } catch {}
}

export class StorageManager {
  private static cache: Map<string, GuildDataStore> = new Map();
  private static statsCache: Map<string, CommandStatsRecord> = new Map();
  private static isInitialized = false;

  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      console.log("[StorageManager] Initializing and preloading from Supabase PostgreSQL...");

      // 1. Ensure tables exist
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS guild_configs (
          guild_id TEXT PRIMARY KEY,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS command_metrics (
          command_name TEXT PRIMARY KEY,
          total_calls INT NOT NULL DEFAULT 0,
          success_calls INT NOT NULL DEFAULT 0,
          fail_calls INT NOT NULL DEFAULT 0,
          avg_duration_ms INT NOT NULL DEFAULT 0,
          last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS user_sessions (
          user_id TEXT PRIMARY KEY,
          session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // 2. Preload all guilds into memory cache
      const guildRes = await dbPool.query("SELECT guild_id, data FROM guild_configs");
      for (const row of guildRes.rows) {
        const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        const merged = { ...this.getDefaultGuildData(row.guild_id), ...parsed };
        this.cache.set(row.guild_id, merged);
      }
      console.log(`[StorageManager] Preloaded ${guildRes.rows.length} guilds from Supabase.`);

      // 3. Preload all command metrics
      const statsRes = await dbPool.query("SELECT * FROM command_metrics");
      for (const row of statsRes.rows) {
        this.statsCache.set(row.command_name, {
          commandName: row.command_name,
          totalCalls: Number(row.total_calls),
          successCalls: Number(row.success_calls),
          failCalls: Number(row.fail_calls),
          avgDurationMs: Number(row.avg_duration_ms),
          lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : new Date().toISOString(),
        });
      }
      console.log(`[StorageManager] Preloaded ${statsRes.rows.length} metrics from Supabase.`);

      this.isInitialized = true;
    } catch (err: any) {
      console.error("[StorageManager] Warning: Supabase preloading error, falling back to local files:", err.message);
      this.loadLocalFallbacks();
    }
  }

  private static loadLocalFallbacks(): void {
    if (fs.existsSync(GUILDS_DIR)) {
      try {
        const files = fs.readdirSync(GUILDS_DIR).filter((f) => f.endsWith(".json"));
        for (const file of files) {
          const guildId = file.replace(".json", "");
          const raw = fs.readFileSync(path.join(GUILDS_DIR, file), "utf-8");
          const parsed = JSON.parse(raw);
          this.cache.set(guildId, { ...this.getDefaultGuildData(guildId), ...parsed });
        }
      } catch {}
    }
    this.loadStats();
  }

  public static getDefaultGuildData(guildId: string): GuildDataStore {
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

    // Try reading from local file if cache miss
    const filePath = path.join(GUILDS_DIR, `${guildId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const merged = { ...this.getDefaultGuildData(guildId), ...parsed };
        this.cache.set(guildId, merged);
        return merged;
      } catch {}
    }

    const def = this.getDefaultGuildData(guildId);
    this.saveGuildData(def);
    return def;
  }

  /**
   * Save guild data store to Supabase PostgreSQL & cache
   */
  public static saveGuildData(data: GuildDataStore): void {
    this.cache.set(data.guildId, data);

    // 1. Asynchronously persist to Supabase PostgreSQL
    dbPool
      .query(
        `
        INSERT INTO guild_configs (guild_id, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (guild_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `,
        [data.guildId, JSON.stringify(data)]
      )
      .catch((err) => {
        console.warn(`[StorageManager] Failed to persist guild ${data.guildId} to Supabase:`, err.message);
      });

    // 2. Best-effort local file backup
    try {
      const filePath = path.join(GUILDS_DIR, `${data.guildId}.json`);
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tempPath, filePath);
    } catch {}
  }

  /**
   * Record command execution stats (to Supabase PostgreSQL & memory cache)
   */
  public static recordCommandMetric(
    commandName: string,
    success: boolean,
    durationMs: number
  ): void {
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

    // Asynchronously update Supabase PostgreSQL
    dbPool
      .query(
        `
        INSERT INTO command_metrics (command_name, total_calls, success_calls, fail_calls, avg_duration_ms, last_used_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (command_name) DO UPDATE SET
          total_calls = EXCLUDED.total_calls,
          success_calls = EXCLUDED.success_calls,
          fail_calls = EXCLUDED.fail_calls,
          avg_duration_ms = EXCLUDED.avg_duration_ms,
          last_used_at = NOW();
      `,
        [metric.commandName, metric.totalCalls, metric.successCalls, metric.failCalls, metric.avgDurationMs]
      )
      .catch(() => {});

    // Best-effort local file backup
    this.saveStats();
  }

  public static getCommandMetrics(): CommandStatsRecord[] {
    return Array.from(this.statsCache.values());
  }

  private static loadStats(): void {
    if (fs.existsSync(GLOBAL_STATS_FILE)) {
      try {
        const raw = fs.readFileSync(GLOBAL_STATS_FILE, "utf-8");
        const list: CommandStatsRecord[] = JSON.parse(raw);
        for (const item of list) {
          if (!this.statsCache.has(item.commandName)) {
            this.statsCache.set(item.commandName, item);
          }
        }
      } catch {}
    }
  }

  private static saveStats(): void {
    try {
      const list = Array.from(this.statsCache.values());
      const tempPath = `${GLOBAL_STATS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), "utf-8");
      fs.renameSync(tempPath, GLOBAL_STATS_FILE);
    } catch {}
  }
}
