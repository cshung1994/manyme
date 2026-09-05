import { Database } from 'bun:sqlite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    const envUrl = process.env.DATABASE_URL
    const dbPath = envUrl?.startsWith('file:')
      ? envUrl.slice(5) // strip "file:" prefix
      : resolve(__dirname, '../../dev.db');
    db = new Database(dbPath, { create: true });
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}
