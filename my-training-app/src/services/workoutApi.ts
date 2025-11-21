import type { Exercise, Workout, WorkoutCompletion } from '../types/workout';

const API_BASE_URL = 'http://localhost:3000/api';

// Database response interfaces
interface DbWorkoutExercise {
  exercise_id: string;
  instructions?: string;
  sets: number;
  reps: number;
  weight?: number;
}

interface DbWorkout {
  id: string;
  name: string;
  instructions?: string;
  days_of_week: number[];
  exercises?: DbWorkoutExercise[];
}

interface DbSetCompletion {
  reps: number;
  weight: number;
  completed: boolean;
}

interface DbExerciseCompletion {
  exercise_id: string;
  sets?: DbSetCompletion[];
}

interface DbWorkoutCompletion {
  workout_id: string;
  date: string;
  completed: boolean;
  exercises?: DbExerciseCompletion[];
}

// Classe para gerenciar comunicação com a API
class WorkoutAPI {
  private username: string | null = null;

  // Configurar usuário
  setUser(username: string): void {
    this.username = username;
  }

  // Headers padrão com usuário
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.username) {
      headers['x-username'] = this.username;
    }

    return headers;
  }

  // Método auxiliar para fazer requisições
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  // === USER METHODS ===
  async createUser(username: string): Promise<{ id: number; username: string; created_at: string }> {
    const response = await this.request<{ id: number; username: string; created_at: string }>('/users', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    this.setUser(username);
    return response;
  }

  // === EXERCISE METHODS ===
  async getExercises(): Promise<Exercise[]> {
    if (!this.username) throw new Error('No user set');
    return this.request<Exercise[]>('/exercises');
  }

  async createExercise(exercise: Omit<Exercise, 'created_at'>): Promise<Exercise> {
    if (!this.username) throw new Error('No user set');
    return this.request<Exercise>('/exercises', {
      method: 'POST',
      body: JSON.stringify({
        id: exercise.id,
        name: exercise.name,
        imageUrl: exercise.imageUrl,
      }),
    });
  }

  async updateExercise(id: string, updates: Partial<Pick<Exercise, 'name' | 'imageUrl'>>): Promise<Exercise> {
    if (!this.username) throw new Error('No user set');
    return this.request<Exercise>(`/exercises/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: updates.name,
        imageUrl: updates.imageUrl,
      }),
    });
  }

  async deleteExercise(id: string): Promise<void> {
    if (!this.username) throw new Error('No user set');
    await this.request(`/exercises/${id}`, {
      method: 'DELETE',
    });
  }

  // === WORKOUT METHODS ===
  async getWorkouts(): Promise<Workout[]> {
    if (!this.username) throw new Error('No user set');
    const workouts = await this.request<DbWorkout[]>('/workouts');

    // Add null/undefined checks for safer mapping
      if (!Array.isArray(workouts)) {
        console.warn('API returned non-array data for workouts:', workouts);
        return [];
      }
    
    // Converter do formato do banco para o formato do frontend
    return workouts.map(workout => ({
      id: workout.id,
      name: workout.name,
      instructions: workout.instructions,
      daysOfWeek: workout.days_of_week || [],
      exercises: workout.exercises?.map((ex: DbWorkoutExercise) => ({
        exerciseId: ex.exercise_id,
        instructions: ex.instructions,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
      })) || [],
    }));
  }

  async getWorkout(id: string): Promise<Workout | null> {
    if (!this.username) throw new Error('No user set');
    try {
      const workout = await this.request<DbWorkout>(`/workouts/${id}`);
      
      // Converter do formato do banco para o formato do frontend
      return {
        id: workout.id,
        name: workout.name,
        instructions: workout.instructions,
        daysOfWeek: workout.days_of_week || [],
        exercises: workout.exercises?.map((ex: DbWorkoutExercise) => ({
          exerciseId: ex.exercise_id,
          instructions: ex.instructions,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
        })) || [],
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async createWorkout(workout: Omit<Workout, 'created_at'>): Promise<Workout> {
    if (!this.username) throw new Error('No user set');
    const response = await this.request<DbWorkout>('/workouts', {
      method: 'POST',
      body: JSON.stringify({
        id: workout.id,
        name: workout.name,
        instructions: workout.instructions,
        daysOfWeek: workout.daysOfWeek,
        exercises: workout.exercises?.map(ex => ({
          exerciseId: ex.exerciseId,
          instructions: ex.instructions,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
        })),
      }),
    });

    // Converter resposta para formato do frontend
    return {
      id: response.id,
      name: response.name,
      instructions: response.instructions,
      daysOfWeek: response.days_of_week || [],
      exercises: response.exercises?.map((ex: DbWorkoutExercise) => ({
        exerciseId: ex.exercise_id,
        instructions: ex.instructions,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
      })) || [],
    };
  }

  async updateWorkout(id: string, workout: Omit<Workout, 'id' | 'created_at'>): Promise<Workout> {
    if (!this.username) throw new Error('No user set');
    const response = await this.request<DbWorkout>(`/workouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: workout.name,
        instructions: workout.instructions,
        daysOfWeek: workout.daysOfWeek,
        exercises: workout.exercises?.map(ex => ({
          exerciseId: ex.exerciseId,
          instructions: ex.instructions,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
        })),
      }),
    });

    // Converter resposta para formato do frontend  
    return {
      id: response.id,
      name: response.name,
      instructions: response.instructions,
      daysOfWeek: response.days_of_week || [],
      exercises: response.exercises?.map((ex: DbWorkoutExercise) => ({
        exerciseId: ex.exercise_id,
        instructions: ex.instructions,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
      })) || [],
    };
  }

  async deleteWorkout(id: string): Promise<void> {
    if (!this.username) throw new Error('No user set');
    await this.request(`/workouts/${id}`, {
      method: 'DELETE',
    });
  }

  // === WORKOUT COMPLETION METHODS ===
  async getCompletions(date?: string, limit?: number): Promise<WorkoutCompletion[]> {
    if (!this.username) throw new Error('No user set');
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    const endpoint = `/completions${queryString ? `?${queryString}` : ''}`;
    
    const completions = await this.request<DbWorkoutCompletion[]>(endpoint);
    
    // Converter do formato do banco para o formato do frontend
    return completions.map(completion => ({
      workoutId: completion.workout_id,
      date: completion.date,
      completed: completion.completed,
      exercises: completion.exercises?.map((ex: DbExerciseCompletion) => ({
        exerciseId: ex.exercise_id,
        sets: ex.sets?.map((set: DbSetCompletion) => ({
          reps: set.reps,
          weight: set.weight,
          completed: set.completed,
        })) || [],
      })) || [],
    }));
  }

  async createCompletion(completion: Omit<WorkoutCompletion, 'created_at'>): Promise<WorkoutCompletion> {
    if (!this.username) throw new Error('No user set');
    const response = await this.request<DbWorkoutCompletion>('/completions', {
      method: 'POST',
      body: JSON.stringify({
        workoutId: completion.workoutId,
        date: completion.date,
        completed: completion.completed,
        exercises: completion.exercises?.map(ex => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets,
        })),
      }),
    });

    // Converter resposta para formato do frontend
    return {
      workoutId: response.workout_id,
      date: response.date,
      completed: response.completed,
      exercises: response.exercises?.map((ex: DbExerciseCompletion) => ({
        exerciseId: ex.exercise_id,
        sets: ex.sets?.map((set: DbSetCompletion) => ({
          reps: set.reps,
          weight: set.weight,
          completed: set.completed,
        })) || [],
      })) || [],
    };
  }

  async updateCompletion(id: number, updates: Partial<Pick<WorkoutCompletion, 'completed'>>): Promise<WorkoutCompletion> {
    if (!this.username) throw new Error('No user set');
    const response = await this.request<DbWorkoutCompletion>(`/completions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    // Converter resposta para formato do frontend
    return {
      workoutId: response.workout_id,
      date: response.date,
      completed: response.completed,
      exercises: response.exercises?.map((ex: DbExerciseCompletion) => ({
        exerciseId: ex.exercise_id,
        sets: ex.sets?.map((set: DbSetCompletion) => ({
          reps: set.reps,
          weight: set.weight,
          completed: set.completed,
        })) || [],
      })) || [],
    };
  }

  // === WORKOUT COMPLETION CONVENIENCE METHODS ===
  
  /**
   * Salva um workout como completado pelo usuário
   */
  async saveWorkoutCompleted(workoutId: string, exercisesCompleted?: WorkoutCompletion['exercises']): Promise<WorkoutCompletion> {
    if (!this.username) throw new Error('No user set');
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const completion: Omit<WorkoutCompletion, 'created_at'> = {
      workoutId,
      date: today,
      completed: true,
      exercises: exercisesCompleted || []
    };

    return this.createCompletion(completion);
  }

  /**
   * Salva o progresso de um exercício específico
   */
  async saveExerciseProgress(
    workoutId: string, 
    exerciseId: string, 
    sets: { reps: number; weight: number; completed: boolean }[]
  ): Promise<WorkoutCompletion> {
    if (!this.username) throw new Error('No user set');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Verificar se já existe uma completion para hoje
    const existingCompletions = await this.getCompletions(today);
    const existingCompletion = existingCompletions.find(c => c.workoutId === workoutId);
    
    if (existingCompletion) {
      // Atualizar completion existente com novo progresso do exercício
      const updatedExercises = existingCompletion.exercises || [];
      const exerciseIndex = updatedExercises.findIndex(ex => ex.exerciseId === exerciseId);
      
      if (exerciseIndex >= 0) {
        updatedExercises[exerciseIndex].sets = sets;
      } else {
        updatedExercises.push({ exerciseId, sets });
      }
      
      // Como não temos um método de update por workoutId+date, vamos criar uma nova completion
      // ou você pode implementar um endpoint específico no backend
      const completion: Omit<WorkoutCompletion, 'created_at'> = {
        workoutId,
        date: today,
        completed: sets.every(set => set.completed),
        exercises: updatedExercises
      };
      
      return this.createCompletion(completion);
    } else {
      // Criar nova completion
      const completion: Omit<WorkoutCompletion, 'created_at'> = {
        workoutId,
        date: today,
        completed: sets.every(set => set.completed),
        exercises: [{ exerciseId, sets }]
      };
      
      return this.createCompletion(completion);
    }
  }

  /**
   * Marca um set específico como completado
   */
  async markSetCompleted(
    workoutId: string, 
    exerciseId: string, 
    setIndex: number, 
    reps: number, 
    weight: number
  ): Promise<WorkoutCompletion> {
    if (!this.username) throw new Error('No user set');
    
    const today = new Date().toISOString().split('T')[0];
    const existingCompletions = await this.getCompletions(today);
    const existingCompletion = existingCompletions.find(c => c.workoutId === workoutId);
    
    let exercises: WorkoutCompletion['exercises'] = [];
    
    if (existingCompletion) {
      exercises = [...(existingCompletion.exercises || [])];
    }
    
    // Encontrar ou criar o exercício
    let exerciseCompletion = exercises.find(ex => ex.exerciseId === exerciseId);
    if (!exerciseCompletion) {
      exerciseCompletion = { exerciseId, sets: [] };
      exercises.push(exerciseCompletion);
    }
    
    // Garantir que temos sets suficientes
    while (exerciseCompletion.sets.length <= setIndex) {
      exerciseCompletion.sets.push({ reps: 0, weight: 0, completed: false });
    }
    
    // Marcar o set como completado
    exerciseCompletion.sets[setIndex] = { reps, weight, completed: true };
    
    const completion: Omit<WorkoutCompletion, 'created_at'> = {
      workoutId,
      date: today,
      completed: false, // Só marca como completado quando todos os exercícios estiverem prontos
      exercises
    };
    
    return this.createCompletion(completion);
  }

  /**
   * Obtém o progresso atual de um workout para hoje
   */
  async getTodayWorkoutProgress(workoutId: string): Promise<WorkoutCompletion | null> {
    if (!this.username) throw new Error('No user set');
    
    const today = new Date().toISOString().split('T')[0];
    const completions = await this.getCompletions(today);
    
    return completions.find(c => c.workoutId === workoutId) || null;
  }
}

// Instância singleton da API
export const workoutAPI = new WorkoutAPI();

// Função para configurar usuário (compatibilidade com código existente)
export const setCurrentUser = (username: string) => {
  workoutAPI.setUser(username);
  workoutAPI.createUser(username).catch(console.error); // Criar usuário se não existir
};

// Funções de compatibilidade com o storage.ts existente
export const getUser = (): string | null => {
  // Manter compatibilidade - o usuário agora é gerenciado pela API
  return localStorage.getItem('workout-tracker-user');
};

export const saveUser = (user: string): void => {
  localStorage.setItem('workout-tracker-user', user);
  setCurrentUser(user);
};

export const clearUser = (): void => {
  localStorage.removeItem('workout-tracker-user');
  workoutAPI.setUser('');
};

// Substituir funções do storage.ts para usar a API
export const getExercises = async (): Promise<Exercise[]> => {
  return workoutAPI.getExercises();
};

export const saveExercises = async (): Promise<void> => {
  // Esta função não é mais necessária pois salvamos individualmente via API
  console.warn('saveExercises is deprecated - use workoutAPI.createExercise instead');
};

export const getWorkouts = async (): Promise<Workout[]> => {
  return workoutAPI.getWorkouts();
};

export const saveWorkouts = async (): Promise<void> => {
  // Esta função não é mais necessária pois salvamos individualmente via API
  console.warn('saveWorkouts is deprecated - use workoutAPI.createWorkout instead');
};

export const getCompletions = async (): Promise<WorkoutCompletion[]> => {
  return workoutAPI.getCompletions();
};

export const saveCompletions = async (): Promise<void> => {
  // Esta função não é mais necessária pois salvamos individualmente via API
  console.warn('saveCompletions is deprecated - use workoutAPI.createCompletion instead');
};

// === FUNÇÕES DE CONVENIÊNCIA PARA SALVAR WORKOUTS COMPLETADOS ===

/**
 * Salva um workout como completado pelo usuário
 */
export const saveWorkoutCompleted = async (
  workoutId: string, 
  exercisesCompleted?: WorkoutCompletion['exercises']
): Promise<WorkoutCompletion> => {
  return workoutAPI.saveWorkoutCompleted(workoutId, exercisesCompleted);
};

/**
 * Salva o progresso de um exercício específico
 */
export const saveExerciseProgress = async (
  workoutId: string, 
  exerciseId: string, 
  sets: { reps: number; weight: number; completed: boolean }[]
): Promise<WorkoutCompletion> => {
  return workoutAPI.saveExerciseProgress(workoutId, exerciseId, sets);
};

/**
 * Marca um set específico como completado
 */
export const markSetCompleted = async (
  workoutId: string, 
  exerciseId: string, 
  setIndex: number, 
  reps: number, 
  weight: number
): Promise<WorkoutCompletion> => {
  return workoutAPI.markSetCompleted(workoutId, exerciseId, setIndex, reps, weight);
};

/**
 * Obtém o progresso atual de um workout para hoje
 */
export const getTodayWorkoutProgress = async (workoutId: string): Promise<WorkoutCompletion | null> => {
  return workoutAPI.getTodayWorkoutProgress(workoutId);
};