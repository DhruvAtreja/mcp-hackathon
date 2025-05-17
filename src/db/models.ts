import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

export async function initDb(dbPath: string = './skynet.db'): Promise<Database> {
  if (db) {
    return db;
  }
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      auth_token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Memory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES User(id)
    );

    CREATE TABLE IF NOT EXISTS AccessPermission (
      id TEXT PRIMARY KEY,
      granter_user_id TEXT NOT NULL,
      grantee_user_id TEXT NOT NULL,
      access_level TEXT CHECK(access_level IN ('read', 'write')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (granter_user_id) REFERENCES User(id),
      FOREIGN KEY (grantee_user_id) REFERENCES User(id)
    );

    CREATE TABLE IF NOT EXISTS AccessToken (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      granter_user_id TEXT NOT NULL,
      access_level TEXT CHECK(access_level IN ('read', 'write')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_used BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (granter_user_id) REFERENCES User(id)
    );
  `);

  console.log('Database initialized and tables created/ensured.');
  return db;
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb first.');
  }
  return db;
}

// SQLite/ORM models 