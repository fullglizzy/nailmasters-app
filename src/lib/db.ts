import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

// Глобальный кеш для development (избегаем множественных соединений при HMR)
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined;
  client: ReturnType<typeof postgres> | undefined;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL must be set in production');
    }
    console.warn('⚠ DATABASE_URL not set — using dev fallback. Do NOT use in production.');
    return 'postgres://nailmasters:nailmasters_secret@localhost:5432/nailmasters';
  }
  return url;
}

const databaseUrl = getDatabaseUrl();

function createDbClient() {
  if (globalForDb.db && globalForDb.client) {
    return { db: globalForDb.db, client: globalForDb.client };
  }

  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  const db = drizzle(client, { schema, logger: false });

  if (process.env.NODE_ENV === 'development') {
    globalForDb.db = db;
    globalForDb.client = client;
  }

  return { db, client };
}

export const { db, client: pgClient } = createDbClient();
export { schema };
