import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'password123'; // Default password for existing users

// Open existing database
const db = new Database(join(__dirname, 'workout_tracker.db'));

console.log('Starting database migration...');

try {
  // Check if password_hash column already exists
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const hasPasswordHash = tableInfo.some(col => col.name === 'password_hash');

  if (hasPasswordHash) {
    console.log('✓ Database already migrated. password_hash column exists.');
  } else {
    console.log('Adding password_hash column to users table...');
    
    // Add password_hash column with a temporary default value
    db.exec(`
      ALTER TABLE users ADD COLUMN password_hash TEXT;
    `);
    
    // Get all existing users
    const users = db.prepare('SELECT id, username FROM users WHERE password_hash IS NULL').all();
    
    if (users.length > 0) {
      console.log(`Found ${users.length} users without passwords. Setting default password...`);
      
      // Hash the default password
      const defaultHash = bcrypt.hashSync(DEFAULT_PASSWORD, SALT_ROUNDS);
      
      // Update all users with the default password hash
      const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
      
      for (const user of users) {
        updateStmt.run(defaultHash, user.id);
        console.log(`  - Updated user: ${user.username}`);
      }
      
      console.log(`\n⚠️  IMPORTANT: All existing users now have the default password: "${DEFAULT_PASSWORD}"`);
      console.log('   Please ask users to login and change their passwords.\n');
    }
    
    console.log('✓ Migration completed successfully!');
  }
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
