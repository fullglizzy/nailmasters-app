// Run full-text search migration
// Usage: npx tsx src/db/migrate-search.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL || 'postgres://nailmasters:nailmasters_secret@localhost:5432/nailmasters';

async function main() {
  const sql = postgres(dbUrl, { max: 1 });

  try {
    const migrationPath = join(import.meta.dirname || __dirname, 'migrations', '0001_add_search_vector.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    console.log('Applying search_vector migration...');
    await sql.unsafe(migrationSql);
    console.log('✅ Full-text search migration applied successfully');

  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log('✅ Migration already applied, skipping');
    } else {
      console.error('Migration failed:', err.message);
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

main();
