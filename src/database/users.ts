import fs from "node:fs";
import path from "node:path";
import { dbPool } from "./db.js";

export interface UserProfileStore {
  userId: string;
  username?: string;
  avatar?: string;
  globalPoints: number;
  level: number;
  xp: number;
  reputation: number;
  badges: string[];
  verification: {
    phoneVerified: boolean;
    phoneCarrier?: string;
    phoneVerifiedAt?: string;
    emailVerified: boolean;
    emailAddress?: string;
    emailVerifiedAt?: string;
  };
  attendance: {
    lastAttendanceDate?: string;
    streak: number;
    totalAttendance: number;
  };
  inventory: Array<{
    itemId: string;
    name: string;
    acquiredAt: string;
    guildId?: string;
  }>;
  linkedGuilds: string[];
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const USERS_DIR = path.join(DATA_DIR, "users");

if (!fs.existsSync(USERS_DIR)) {
  try {
    fs.mkdirSync(USERS_DIR, { recursive: true });
  } catch {}
}

export class UserManager {
  private static cache: Map<string, UserProfileStore> = new Map();
  private static isInitialized = false;

  public static getDefaultProfile(userId: string): UserProfileStore {
    return {
      userId,
      globalPoints: 0,
      level: 1,
      xp: 0,
      reputation: 0,
      badges: ["NEWBIE"],
      verification: {
        phoneVerified: false,
        emailVerified: false,
      },
      attendance: {
        streak: 0,
        totalAttendance: 0,
      },
      inventory: [],
      linkedGuilds: [],
      bio: "Sora 봇과 함께하는 글로벌 유저입니다.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      // Ensure user_profiles table exists in Supabase
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          user_id TEXT PRIMARY KEY,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Preload users from Supabase into memory
      const res = await dbPool.query("SELECT user_id, data FROM user_profiles");
      for (const row of res.rows) {
        const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        const merged = { ...this.getDefaultProfile(row.user_id), ...parsed };
        this.cache.set(row.user_id, merged);

        // Backup to local file
        this.saveToFile(row.user_id, merged);
      }
      console.log(`[UserManager] Preloaded ${res.rows.length} user profiles from Supabase.`);

      // Also check local files in data/users
      if (fs.existsSync(USERS_DIR)) {
        const files = fs.readdirSync(USERS_DIR).filter((f) => f.endsWith(".json"));
        for (const file of files) {
          const uId = file.replace(".json", "");
          if (!this.cache.has(uId)) {
            try {
              const raw = fs.readFileSync(path.join(USERS_DIR, file), "utf-8");
              const parsed = JSON.parse(raw);
              this.cache.set(uId, { ...this.getDefaultProfile(uId), ...parsed });
            } catch {}
          }
        }
      }

      this.isInitialized = true;
    } catch (err: any) {
      console.warn("[UserManager] Preloading warning:", err.message);
    }
  }

  /**
   * Get user profile by userId (0ms cache lookup)
   */
  public static getUser(userId: string): UserProfileStore {
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    // Check local file
    const filePath = path.join(USERS_DIR, `${userId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const merged = { ...this.getDefaultProfile(userId), ...parsed };
        this.cache.set(userId, merged);
        return merged;
      } catch {}
    }

    const def = this.getDefaultProfile(userId);
    this.saveUser(def);
    return def;
  }

  /**
   * Save user profile to Supabase PostgreSQL and local file data/users/{userId}.json
   */
  public static saveUser(user: UserProfileStore): void {
    user.updatedAt = new Date().toISOString();
    this.cache.set(user.userId, user);

    // 1. Asynchronously persist to Supabase PostgreSQL
    dbPool
      .query(
        `
        INSERT INTO user_profiles (user_id, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `,
        [user.userId, JSON.stringify(user)]
      )
      .catch((e) => {
        console.warn(`[UserManager] Failed to persist user ${user.userId} to Supabase:`, e.message);
      });

    // 2. Best-effort local file backup
    this.saveToFile(user.userId, user);
  }

  private static saveToFile(userId: string, data: UserProfileStore): void {
    try {
      if (!fs.existsSync(USERS_DIR)) {
        fs.mkdirSync(USERS_DIR, { recursive: true });
      }
      const filePath = path.join(USERS_DIR, `${userId}.json`);
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tempPath, filePath);
    } catch {}
  }

  /**
   * Record guild activity for a user
   */
  public static touchUser(userId: string, guildId?: string, username?: string, avatar?: string): UserProfileStore {
    const user = this.getUser(userId);
    let changed = false;
    if (username && user.username !== username) {
      user.username = username;
      changed = true;
    }
    if (avatar && user.avatar !== avatar) {
      user.avatar = avatar;
      changed = true;
    }
    if (guildId && !user.linkedGuilds.includes(guildId)) {
      user.linkedGuilds.push(guildId);
      changed = true;
    }
    if (changed) {
      this.saveUser(user);
    }
    return user;
  }
}
