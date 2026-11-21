export interface GuildVerificationConfig {
  enabled: boolean;
  channelId?: string;
  methods: Array<"phone" | "email" | "button" | "captcha">;
  roleMappings: Record<string, string>; // method -> roleId
  messageId?: string;
  updatedAt: string;
}

export interface VerificationSession {
  id: string; // session ID or sendwich vrf ID
  guildId: string;
  userId: string;
  method: "phone" | "email" | "button" | "captcha";
  status: "pending" | "verified" | "expired" | "cancelled";
  roleId: string;
  code?: string; // for email or captcha
  destination?: string; // for phone
  smsText?: string; // for phone
  createdAt: string;
  expiresAt: string;
}

export interface GuildWelcomeConfig {
  enabled: boolean;
  channelId?: string;
  messageTemplate: string;
  embedColor?: number;
}

export interface GuildGoodbyeConfig {
  enabled: boolean;
  channelId?: string;
  messageTemplate: string;
}

export interface GuildAutoRoleConfig {
  id: string;
  roleId: string;
  roleName: string;
  target: "all" | "human" | "bot";
  createdAt: string;
}

export interface GuildAutoMessageConfig {
  id: string;
  channelId: string;
  intervalMinutes: number;
  content: string;
  enabled: boolean;
  lastSentAt?: string;
}

export interface GuildTicketConfig {
  enabled: boolean;
  channelId?: string; // panel channel
  categoryId?: string; // tickets category
  supportRoleId?: string;
  categories: Array<{
    id: string;
    label: string;
    description: string;
    emoji?: string;
  }>;
}

export interface TicketSession {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  category: string;
  status: "open" | "closed" | "claimed";
  claimedBy?: string;
  createdAt: string;
  closedAt?: string;
}

export interface WarningRecord {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: string;
  active: boolean;
}

export interface ModerationAuditRecord {
  id: string;
  guildId: string;
  type: "warn" | "warn_remove" | "timeout" | "timeout_remove" | "kick" | "ban" | "unban" | "channel_lock" | "channel_unlock" | "channel_delete";
  targetId: string;
  moderatorId: string;
  reason?: string;
  createdAt: string;
}

export interface WikiDocument {
  id: string;
  guildId: string;
  slug: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  version: number;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  links: string[]; // target slugs
  backlinks: string[]; // referencing slugs
  history: Array<{
    version: number;
    editorId: string;
    updatedAt: string;
    summary: string;
  }>;
}

export interface UserPointRecord {
  guildId: string;
  userId: string;
  points: number;
  lastAttendanceDate?: string;
  attendanceStreak: number;
  inventory: Array<{
    itemId: string;
    itemName: string;
    acquiredAt: string;
  }>;
}

export interface ShopItem {
  id: string;
  guildId: string;
  name: string;
  price: number;
  description: string;
  roleId?: string;
  stock?: number;
}

export interface CommandStatsRecord {
  commandName: string;
  totalCalls: number;
  successCalls: number;
  failCalls: number;
  avgDurationMs: number;
  lastUsedAt: string;
}

export interface GuildDataStore {
  guildId: string;
  verification: GuildVerificationConfig;
  welcome: GuildWelcomeConfig;
  goodbye: GuildGoodbyeConfig;
  autoRoles: GuildAutoRoleConfig[];
  autoMessages: GuildAutoMessageConfig[];
  tickets: GuildTicketConfig;
  ticketSessions: TicketSession[];
  warnings: WarningRecord[];
  moderationAudit: ModerationAuditRecord[];
  wikiDocuments: WikiDocument[];
  points: Record<string, UserPointRecord>; // userId -> data
  shopItems: ShopItem[];
  verificationSessions: VerificationSession[];
}
