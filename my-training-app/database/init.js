import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicializar banco de dados
const db = new Database(join(__dirname, 'workout_tracker.db'));

// Configurar para WAL mode (melhor para concorrência)
db.pragma('journal_mode = WAL');

// Função para inicializar as tabelas
export function initializeDatabase() {
  // Tabela de usuários
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de exercícios
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Tabela de treinos
  db.exec(`
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      instructions TEXT,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Tabela de dias da semana para treinos (relação many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS workout_days (
      workout_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      PRIMARY KEY (workout_id, day_of_week),
      FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE
    )
  `);

  // Tabela de exercícios em treinos
  db.exec(`
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      instructions TEXT,
      sets INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
    )
  `);

  // Tabela de conclusões de treinos
  db.exec(`
    CREATE TABLE IF NOT EXISTS workout_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL, -- ISO date string
      completed BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Tabela de conclusões de exercícios
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercise_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      completion_id INTEGER NOT NULL,
      exercise_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (completion_id) REFERENCES workout_completions (id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
    )
  `);

  // Tabela de conclusões de séries
  db.exec(`
    CREATE TABLE IF NOT EXISTS set_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_completion_id INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT 0,
      set_index INTEGER NOT NULL,
      FOREIGN KEY (exercise_completion_id) REFERENCES exercise_completions (id) ON DELETE CASCADE
    )
  `);

  // Criar índices para melhor performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises (user_id);
    CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts (user_id);
    CREATE INDEX IF NOT EXISTS idx_workout_completions_user_date ON workout_completions (user_id, date);
    CREATE INDEX IF NOT EXISTS idx_workout_completions_workout_id ON workout_completions (workout_id);
  `);

  console.log('Database initialized successfully!');
}

export default db;