import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './database/init.js';
import { 
  UserRepository, 
  ExerciseRepository, 
  WorkoutRepository, 
  WorkoutCompletionRepository 
} from './database/repositories.js';

const app = express();
const PORT = 3000;

// Initialize database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Counter state (mantido para compatibilidade)
let counterState = {
  count: 0,
  lastUpdated: new Date().toISOString()
};

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the Counter API Server!',
    endpoints: {
      'GET /api/counter': 'Get current counter value',
      'POST /api/counter/increment': 'Increment counter by 1',
      'POST /api/counter/decrement': 'Decrement counter by 1',
      'POST /api/counter/reset': 'Reset counter to 0',
      'GET /api/health': 'Health check'
    },
    currentCount: counterState.count
  });
});

// Endpoint to get current counter
app.get('/api/counter', (req, res) => {
  console.log(`📊 Counter queried: ${counterState.count}`);
  
  res.json({
    success: true,
    message: 'Counter retrieved successfully',
    data: {
      count: counterState.count,
      lastUpdated: counterState.lastUpdated
    }
  });
});

// Endpoint to increment counter
app.post('/api/counter/increment', (req, res) => {
  counterState.count += 1;
  counterState.lastUpdated = new Date().toISOString();
  
  // Log as requested
  console.log('Plus 1');
  console.log(`📈 Counter incremented to: ${counterState.count}`);
  
  res.json({
    success: true,
    message: 'Counter incremented successfully',
    data: {
      count: counterState.count,
      lastUpdated: counterState.lastUpdated
    }
  });
});

// Endpoint to decrement counter
app.post('/api/counter/decrement', (req, res) => {
  counterState.count -= 1;
  counterState.lastUpdated = new Date().toISOString();
  
  console.log(`📉 Counter decremented to: ${counterState.count}`);
  
  res.json({
    success: true,
    message: 'Counter decremented successfully',
    data: {
      count: counterState.count,
      lastUpdated: counterState.lastUpdated
    }
  });
});

// Endpoint to reset counter
app.post('/api/counter/reset', (req, res) => {
  counterState.count = 0;
  counterState.lastUpdated = new Date().toISOString();
  
  console.log('🔄 Counter reset to: 0');
  
  res.json({
    success: true,
    message: 'Counter reset successfully',
    data: {
      count: counterState.count,
      lastUpdated: counterState.lastUpdated
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// ===== WORKOUT TRACKER API ROUTES =====

// Middleware para verificar e obter usuário
const getUserMiddleware = (req, res, next) => {
  const username = req.headers['x-username'] || req.body.username || req.query.username;
  
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username is required',
      error: 'NO_USERNAME'
    });
  }

  try {
    const user = UserRepository.findOrCreate(username);
    req.user = user;
    next();
  } catch (error) {
    console.error('Error handling user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'USER_ERROR'
    });
  }
};

// --- USER ROUTES ---
app.post('/api/users', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    const user = UserRepository.findOrCreate(username);
    res.json({
      success: true,
      message: 'User created/found successfully',
      data: user
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});

// --- EXERCISE ROUTES ---
app.get('/api/exercises', getUserMiddleware, (req, res) => {
  try {
    const exercises = ExerciseRepository.findByUserId(req.user.id);
    res.json({
      success: true,
      message: 'Exercises retrieved successfully',
      data: exercises
    });
  } catch (error) {
    console.error('Error fetching exercises:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exercises',
      error: error.message
    });
  }
});

app.post('/api/exercises', getUserMiddleware, (req, res) => {
  try {
    const { id, name, imageUrl } = req.body;
    
    if (!id || !name) {
      return res.status(400).json({
        success: false,
        message: 'ID and name are required'
      });
    }

    const exercise = ExerciseRepository.create({
      id,
      name,
      image_url: imageUrl,
      user_id: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Exercise created successfully',
      data: exercise
    });
  } catch (error) {
    console.error('Error creating exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create exercise',
      error: error.message
    });
  }
});

app.put('/api/exercises/:id', getUserMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, imageUrl } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (imageUrl !== undefined) updates.image_url = imageUrl;

    const exercise = ExerciseRepository.update(id, updates);
    
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    res.json({
      success: true,
      message: 'Exercise updated successfully',
      data: exercise
    });
  } catch (error) {
    console.error('Error updating exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update exercise',
      error: error.message
    });
  }
});

app.delete('/api/exercises/:id', getUserMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const success = ExerciseRepository.delete(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    res.json({
      success: true,
      message: 'Exercise deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete exercise',
      error: error.message
    });
  }
});

// --- WORKOUT ROUTES ---
app.get('/api/workouts', getUserMiddleware, (req, res) => {
  try {
    const workouts = WorkoutRepository.findByUserId(req.user.id);
    res.json({
      success: true,
      message: 'Workouts retrieved successfully',
      data: workouts
    });
  } catch (error) {
    console.error('Error fetching workouts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workouts',
      error: error.message
    });
  }
});

app.get('/api/workouts/:id', getUserMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const workout = WorkoutRepository.findById(id);
    
    if (!workout) {
      return res.status(404).json({
        success: false,
        message: 'Workout not found'
      });
    }

    res.json({
      success: true,
      message: 'Workout retrieved successfully',
      data: workout
    });
  } catch (error) {
    console.error('Error fetching workout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workout',
      error: error.message
    });
  }
});

app.post('/api/workouts', getUserMiddleware, (req, res) => {
  try {
    const { id, name, instructions, daysOfWeek, exercises } = req.body;
    
    if (!id || !name) {
      return res.status(400).json({
        success: false,
        message: 'ID and name are required'
      });
    }

    // Criar workout
    const workout = WorkoutRepository.create({
      id,
      name,
      instructions: instructions || '',
      user_id: req.user.id,
      days_of_week: daysOfWeek || []
    });

    // Adicionar exercícios se fornecidos
    if (exercises && exercises.length > 0) {
      exercises.forEach((exercise, index) => {
        WorkoutRepository.addExercise(id, {
          exercise_id: exercise.exerciseId,
          instructions: exercise.instructions || '',
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          order_index: index
        });
      });
    }

    // Buscar workout completo para retornar
    const completeWorkout = WorkoutRepository.findById(id);

    res.status(201).json({
      success: true,
      message: 'Workout created successfully',
      data: completeWorkout
    });
  } catch (error) {
    console.error('Error creating workout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workout',
      error: error.message
    });
  }
});

app.put('/api/workouts/:id', getUserMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, instructions, daysOfWeek, exercises } = req.body;
    
    // Verificar se o workout existe
    const existingWorkout = WorkoutRepository.findById(id);
    if (!existingWorkout) {
      return res.status(404).json({
        success: false,
        message: 'Workout not found'
      });
    }

    // Atualizar workout básico
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (instructions !== undefined) updates.instructions = instructions;
    
    if (Object.keys(updates).length > 0) {
      WorkoutRepository.update(id, updates);
    }

    // Atualizar dias da semana se fornecidos
    if (daysOfWeek !== undefined) {
      WorkoutRepository.updateDaysOfWeek(id, daysOfWeek);
    }

    // Atualizar exercícios se fornecidos
    if (exercises !== undefined) {
      // Remover exercícios existentes
      WorkoutRepository.clearExercises(id);
      
      // Adicionar novos exercícios
      exercises.forEach((exercise, index) => {
        WorkoutRepository.addExercise(id, {
          exercise_id: exercise.exerciseId,
          instructions: exercise.instructions || '',
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          order_index: index
        });
      });
    }

    // Buscar workout atualizado para retornar
    const updatedWorkout = WorkoutRepository.findById(id);

    res.json({
      success: true,
      message: 'Workout updated successfully',
      data: updatedWorkout
    });
  } catch (error) {
    console.error('Error updating workout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workout',
      error: error.message
    });
  }
});

app.delete('/api/workouts/:id', getUserMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const success = WorkoutRepository.delete(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Workout not found'
      });
    }

    res.json({
      success: true,
      message: 'Workout deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting workout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete workout',
      error: error.message
    });
  }
});

// --- WORKOUT COMPLETION ROUTES ---
app.get('/api/completions', getUserMiddleware, (req, res) => {
  try {
    const { date, limit } = req.query;
    let completions;

    if (date) {
      completions = WorkoutCompletionRepository.findByUserAndDate(req.user.id, date);
    } else {
      completions = WorkoutCompletionRepository.findByUserId(req.user.id, limit ? parseInt(limit) : undefined);
    }

    res.json({
      success: true,
      message: 'Completions retrieved successfully',
      data: completions
    });
  } catch (error) {
    console.error('Error fetching completions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch completions',
      error: error.message
    });
  }
});

app.post('/api/completions', getUserMiddleware, (req, res) => {
  try {
    const { workoutId, date, completed, exercises } = req.body;
    
    if (!workoutId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Workout ID and date are required'
      });
    }

    // Criar completion
    const completion = WorkoutCompletionRepository.create({
      workout_id: workoutId,
      user_id: req.user.id,
      date,
      completed: completed || false
    });

    // Adicionar exercícios se fornecidos
    if (exercises && exercises.length > 0) {
      exercises.forEach(exercise => {
        WorkoutCompletionRepository.addExerciseCompletion(
          completion.id,
          exercise.exerciseId,
          exercise.sets || []
        );
      });
    }

    // Buscar completion completa para retornar
    const completeCompletion = WorkoutCompletionRepository.findById(completion.id);

    res.status(201).json({
      success: true,
      message: 'Completion created successfully',
      data: completeCompletion
    });
  } catch (error) {
    console.error('Error creating completion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create completion',
      error: error.message
    });
  }
});

app.put('/api/completions/:id', getUserMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { completed } = req.body;
    
    const completion = WorkoutCompletionRepository.update(parseInt(id), { completed });
    
    if (!completion) {
      return res.status(404).json({
        success: false,
        message: 'Completion not found'
      });
    }

    res.json({
      success: true,
      message: 'Completion updated successfully',
      data: completion
    });
  } catch (error) {
    console.error('Error updating completion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update completion',
      error: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Initial counter state: ${counterState.count}`);
});