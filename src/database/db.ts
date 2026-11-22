import pg from "pg";
const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.ulgoztichdbwuhgrcsjw:sora-bot*3123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";

export const dbPool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

dbPool.on("error", (err) => {
  console.error("Unexpected Supabase PostgreSQL client error:", err);
});
