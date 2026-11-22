const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres.ulgoztichdbwuhgrcsjw:sora-bot*3123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Connecting to Supabase PostgreSQL at ap-northeast-1...');
    await client.query(`
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
    console.log('Tables guild_configs, command_metrics, user_sessions verified/created!');

    // Migrate guild files
    const guildsDir = path.resolve(__dirname, '../data/guilds');
    if (fs.existsSync(guildsDir)) {
      const files = fs.readdirSync(guildsDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const guildId = file.replace('.json', '');
        const content = fs.readFileSync(path.join(guildsDir, file), 'utf-8');
        const data = JSON.parse(content);
        await client.query(
          `
          INSERT INTO guild_configs (guild_id, data, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (guild_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
        `,
          [guildId, JSON.stringify(data)]
        );
        console.log('Successfully migrated guild into PostgreSQL:', guildId);
      }
    }

    // Migrate global stats
    const statsFile = path.resolve(__dirname, '../data/global_stats.json');
    if (fs.existsSync(statsFile)) {
      const stats = JSON.parse(fs.readFileSync(statsFile, 'utf-8'));
      for (const [cmd, val] of Object.entries(stats)) {
        await client.query(
          `
          INSERT INTO command_metrics (command_name, total_calls, success_calls, fail_calls, avg_duration_ms, last_used_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (command_name) DO UPDATE SET
            total_calls = EXCLUDED.total_calls,
            success_calls = EXCLUDED.success_calls,
            fail_calls = EXCLUDED.fail_calls,
            avg_duration_ms = EXCLUDED.avg_duration_ms,
            last_used_at = EXCLUDED.last_used_at;
        `,
          [
            val.commandName || cmd,
            val.totalCalls || 0,
            val.successCalls || 0,
            val.failCalls || 0,
            val.avgDurationMs || 0,
            val.lastUsedAt || new Date().toISOString(),
          ]
        );
        console.log('Successfully migrated stat into PostgreSQL:', cmd);
      }
    }

    // Query back to verify
    const guildCount = await client.query('SELECT count(*) FROM guild_configs');
    const statsCount = await client.query('SELECT count(*) FROM command_metrics');
    console.log(`Verification: ${guildCount.rows[0].count} guilds and ${statsCount.rows[0].count} stats in PostgreSQL!`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => {
    console.log('Migration to Supabase PostgreSQL finished successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
