"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = exports.initDb = exports.ANOTHER_TEST_USERNAME = exports.ANOTHER_TEST_USER_ID = exports.DEFAULT_TEST_USERNAME = exports.DEFAULT_TEST_USER_ID = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
let db = null;
exports.DEFAULT_TEST_USER_ID = 'user_default_test_uuid';
exports.DEFAULT_TEST_USERNAME = 'default_test_user';
exports.ANOTHER_TEST_USER_ID = 'user_another_test_uuid';
exports.ANOTHER_TEST_USERNAME = 'another_test_user';
function initDb(dbPath = './hivemind.db') {
    return __awaiter(this, void 0, void 0, function* () {
        if (db) {
            return db;
        }
        db = yield (0, sqlite_1.open)({
            filename: dbPath,
            driver: sqlite3_1.default.Database
        });
        // Enable foreign key support
        yield db.exec('PRAGMA foreign_keys = ON;');
        yield db.exec(`
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
        // Ensure default test users exist
        try {
            yield db.run('INSERT OR IGNORE INTO User (id, username, auth_token) VALUES (?, ?, ?), (?, ?, ?)', exports.DEFAULT_TEST_USER_ID, exports.DEFAULT_TEST_USERNAME, `${exports.DEFAULT_TEST_USERNAME}_token`, exports.ANOTHER_TEST_USER_ID, exports.ANOTHER_TEST_USERNAME, `${exports.ANOTHER_TEST_USERNAME}_token`);
            console.log(`Ensured default users (${exports.DEFAULT_TEST_USERNAME}, ${exports.ANOTHER_TEST_USERNAME}) exist.`);
        }
        catch (error) {
            console.error('Error ensuring default users exist:', error);
        }
        console.log('Database initialized and tables created/ensured.');
        return db;
    });
}
exports.initDb = initDb;
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDb first.');
    }
    return db;
}
exports.getDb = getDb;
// SQLite/ORM models 
