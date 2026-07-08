import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://nailmasters:nailmasters_secret@localhost:5432/nailmasters',
  },
  verbose: true,
  strict: true,
});
