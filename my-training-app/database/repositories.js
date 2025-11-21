import db from './init.js';

// Repository para Users
export class UserRepository {
  static create(username) {
    const stmt = db.prepare('INSERT INTO users (username) VALUES (?)');
    const result = stmt.run(username);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  static findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  static findOrCreate(username) {
    let user = this.findByUsername(username);
    if (!user) {
      user = this.create(username);
    }
    return user;
  }
}

// Repository para Exercises
export class ExerciseRepository {
  static create(exercise) {
    const stmt = db.prepare(`
      INSERT INTO exercises (id, name, image_url, user_id) 
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(exercise.id, exercise.name, exercise.image_url, exercise.user_id);
    return this.findById(exercise.id);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM exercises WHERE id = ?');
    return stmt.get(id);
  }

  static findByUserId(userId) {
    const stmt = db.prepare('SELECT * FROM exercises WHERE user_id = ? ORDER BY name');
    return stmt.all(userId);
  }

  static update(id, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    if (fields) {
      const stmt = db.prepare(`UPDATE exercises SET ${fields} WHERE id = ?`);
      stmt.run(...values, id);
    }
    
    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM exercises WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

// Repository para Workouts
export class WorkoutRepository {
  static create(workout) {
    const transaction = db.transaction(() => {
      // Criar workout
      const stmt = db.prepare(`
        INSERT INTO workouts (id, name, instructions, user_id) 
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(workout.id, workout.name, workout.instructions, workout.user_id);

      // Inserir dias da semana
      if (workout.days_of_week && workout.days_of_week.length > 0) {
        const dayStmt = db.prepare('INSERT INTO workout_days (workout_id, day_of_week) VALUES (?, ?)');
        for (const day of workout.days_of_week) {
          dayStmt.run(workout.id, day);
        }
      }
    });

    transaction();
    return this.findById(workout.id);
  }

  static findById(id) {
    // Buscar workout básico
    const stmt = db.prepare('SELECT * FROM workouts WHERE id = ?');
    const workout = stmt.get(id);
    
    if (!workout) return null;

    // Buscar dias da semana
    const daysStmt = db.prepare('SELECT day_of_week FROM workout_days WHERE workout_id = ? ORDER BY day_of_week');
    const days = daysStmt.all(id);

    // Buscar exercícios do workout
    const exercisesStmt = db.prepare(`
      SELECT * FROM workout_exercises 
      WHERE workout_id = ? 
      ORDER BY order_index, id
    `);
    const exercises = exercisesStmt.all(id);

    return {
      ...workout,
      days_of_week: days.map(d => d.day_of_week),
      exercises
    };
  }

  static findByUserId(userId) {
    const stmt = db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY name');
    const workouts = stmt.all(userId);
    
    return workouts.map(workout => this.findById(workout.id));
  }

  static addExercise(workoutId, exercise) {
    const stmt = db.prepare(`
      INSERT INTO workout_exercises (workout_id, exercise_id, instructions, sets, reps, weight, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      workoutId, 
      exercise.exercise_id, 
      exercise.instructions, 
      exercise.sets, 
      exercise.reps, 
      exercise.weight,
      exercise.order_index
    );
    
    const findStmt = db.prepare('SELECT * FROM workout_exercises WHERE id = ?');
    return findStmt.get(result.lastInsertRowid);
  }

  static removeExercise(workoutExerciseId) {
    const stmt = db.prepare('DELETE FROM workout_exercises WHERE id = ?');
    const result = stmt.run(workoutExerciseId);
    return result.changes > 0;
  }

  static update(id, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    if (fields) {
      const stmt = db.prepare(`UPDATE workouts SET ${fields} WHERE id = ?`);
      stmt.run(...values, id);
    }
    
    return this.findById(id);
  }

  static updateDaysOfWeek(workoutId, daysOfWeek) {
    const transaction = db.transaction(() => {
      // Remover dias existentes
      const deleteStmt = db.prepare('DELETE FROM workout_days WHERE workout_id = ?');
      deleteStmt.run(workoutId);
      
      // Adicionar novos dias
      if (daysOfWeek && daysOfWeek.length > 0) {
        const insertStmt = db.prepare('INSERT INTO workout_days (workout_id, day_of_week) VALUES (?, ?)');
        for (const day of daysOfWeek) {
          insertStmt.run(workoutId, day);
        }
      }
    });
    
    transaction();
  }

  static clearExercises(workoutId) {
    const stmt = db.prepare('DELETE FROM workout_exercises WHERE workout_id = ?');
    const result = stmt.run(workoutId);
    return result.changes;
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM workouts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

// Repository para WorkoutCompletions
export class WorkoutCompletionRepository {
  static create(completion) {
    const stmt = db.prepare(`
      INSERT INTO workout_completions (workout_id, user_id, date, completed) 
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(completion.workout_id, completion.user_id, completion.date, completion.completed);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM workout_completions WHERE id = ?');
    const completion = stmt.get(id);
    
    if (!completion) return null;

    // Buscar exercícios da conclusão
    const exercisesStmt = db.prepare(`
      SELECT ec.*, sc.id as set_id, sc.reps as set_reps, sc.weight as set_weight, 
             sc.completed as set_completed, sc.set_index
      FROM exercise_completions ec
      LEFT JOIN set_completions sc ON ec.id = sc.exercise_completion_id
      WHERE ec.completion_id = ?
      ORDER BY ec.id, sc.set_index
    `);
    
    const rows = exercisesStmt.all(id);
    const exercisesMap = new Map();
    
    rows.forEach(row => {
      if (!exercisesMap.has(row.id)) {
        exercisesMap.set(row.id, {
          id: row.id,
          completion_id: row.completion_id,
          exercise_id: row.exercise_id,
          created_at: row.created_at,
          sets: []
        });
      }
      
      if (row.set_id) {
        exercisesMap.get(row.id).sets.push({
          id: row.set_id,
          exercise_completion_id: row.id,
          reps: row.set_reps,
          weight: row.set_weight,
          completed: !!row.set_completed,
          set_index: row.set_index
        });
      }
    });

    return {
      ...completion,
      exercises: Array.from(exercisesMap.values())
    };
  }

  static findByUserAndDate(userId, date) {
    const stmt = db.prepare(`
      SELECT * FROM workout_completions 
      WHERE user_id = ? AND date = ? 
      ORDER BY created_at DESC
    `);
    const completions = stmt.all(userId, date);
    
    return completions.map(c => this.findById(c.id));
  }

  static findByUserId(userId, limit) {
    const sql = `
      SELECT * FROM workout_completions 
      WHERE user_id = ? 
      ORDER BY date DESC, created_at DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `;
    const stmt = db.prepare(sql);
    const completions = stmt.all(userId);
    
    return completions.map(c => this.findById(c.id));
  }

  static addExerciseCompletion(completionId, exerciseId, sets) {
    const transaction = db.transaction(() => {
      // Criar exercise completion
      const exerciseStmt = db.prepare(`
        INSERT INTO exercise_completions (completion_id, exercise_id) 
        VALUES (?, ?)
      `);
      const exerciseResult = exerciseStmt.run(completionId, exerciseId);
      const exerciseCompletionId = exerciseResult.lastInsertRowid;

      // Criar set completions
      const setStmt = db.prepare(`
        INSERT INTO set_completions (exercise_completion_id, reps, weight, completed, set_index)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      sets.forEach((set, index) => {
        setStmt.run(exerciseCompletionId, set.reps, set.weight, set.completed, index);
      });

      return exerciseCompletionId;
    });

    const exerciseCompletionId = transaction();
    
    // Buscar e retornar a exercise completion criada
    const stmt = db.prepare(`
      SELECT ec.*, sc.id as set_id, sc.reps as set_reps, sc.weight as set_weight, 
             sc.completed as set_completed, sc.set_index
      FROM exercise_completions ec
      LEFT JOIN set_completions sc ON ec.id = sc.exercise_completion_id
      WHERE ec.id = ?
      ORDER BY sc.set_index
    `);
    
    const rows = stmt.all(exerciseCompletionId);
    const exerciseCompletion = {
      id: rows[0].id,
      completion_id: rows[0].completion_id,
      exercise_id: rows[0].exercise_id,
      created_at: rows[0].created_at,
      sets: rows.filter(r => r.set_id).map(r => ({
        id: r.set_id,
        exercise_completion_id: r.id,
        reps: r.set_reps,
        weight: r.set_weight,
        completed: !!r.set_completed,
        set_index: r.set_index
      }))
    };

    return exerciseCompletion;
  }

  static update(id, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    if (fields) {
      const stmt = db.prepare(`UPDATE workout_completions SET ${fields} WHERE id = ?`);
      stmt.run(...values, id);
    }
    
    return this.findById(id);
  }
}