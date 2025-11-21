import { Exercise, Workout, WorkoutCompletion } from '../types/workout';

const STORAGE_KEYS = {
  USER: 'workout_app_user',
  EXERCISES: 'workout_app_exercises',
  WORKOUTS: 'workout_app_workouts',
  COMPLETIONS: 'workout_app_completions',
};

// User storage
export const saveUser = (username: string) => {
  localStorage.setItem(STORAGE_KEYS.USER, username);
};

export const getUser = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.USER);
};

export const clearUser = () => {
  localStorage.removeItem(STORAGE_KEYS.USER);
};

// Exercises storage
export const saveExercises = (exercises: Exercise[]) => {
  localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
};

export const getExercises = (): Exercise[] => {
  const data = localStorage.getItem(STORAGE_KEYS.EXERCISES);
  return data ? JSON.parse(data) : [];
};

// Workouts storage
export const saveWorkouts = (workouts: Workout[]) => {
  localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
};

export const getWorkouts = (): Workout[] => {
  const data = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
  return data ? JSON.parse(data) : [];
};

// Workout completions storage
export const saveCompletions = (completions: WorkoutCompletion[]) => {
  localStorage.setItem(STORAGE_KEYS.COMPLETIONS, JSON.stringify(completions));
};

export const getCompletions = (): WorkoutCompletion[] => {
  const data = localStorage.getItem(STORAGE_KEYS.COMPLETIONS);
  return data ? JSON.parse(data) : [];
};
