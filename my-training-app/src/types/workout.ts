export interface Exercise {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  instructions: string;
  sets: number;
  reps: number;
  weight?: number;
}

export interface Workout {
  id: string;
  name: string;
  instructions: string;
  exercises: WorkoutExercise[];
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc.
}

export interface SetCompletion {
  reps: number;
  weight: number;
  completed: boolean;
}

export interface ExerciseCompletion {
  exerciseId: string;
  sets: SetCompletion[];
}

export interface WorkoutCompletion {
  workoutId: string;
  date: string; // ISO date string
  exercises: ExerciseCompletion[];
  completed: boolean;
}