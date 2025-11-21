import type { Exercise, Workout, WorkoutCompletion } from '../types/workout';

const STORAGE_KEYS = {
  USER: 'workout-tracker-user',
  EXERCISES: 'workout-tracker-exercises',
  WORKOUTS: 'workout-tracker-workouts',
  COMPLETIONS: 'workout-tracker-completions',
};

// User management
export const getUser = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.USER);
};

export const saveUser = (user: string): void => {
  localStorage.setItem(STORAGE_KEYS.USER, user);
};

export const clearUser = (): void => {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.EXERCISES);
  localStorage.removeItem(STORAGE_KEYS.WORKOUTS);
  localStorage.removeItem(STORAGE_KEYS.COMPLETIONS);
};

// Exercise management
export const getExercises = (): Exercise[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.EXERCISES);
  return stored ? JSON.parse(stored) : [];
};

export const saveExercises = (exercises: Exercise[]): void => {
  localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
};

// Workout management
export const getWorkouts = (): Workout[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
  return stored ? JSON.parse(stored) : [];
};

export const saveWorkouts = (workouts: Workout[]): void => {
  localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
};

// Completion management
export const getCompletions = (): WorkoutCompletion[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.COMPLETIONS);
  return stored ? JSON.parse(stored) : [];
};

export const saveCompletions = (completions: WorkoutCompletion[]): void => {
  localStorage.setItem(STORAGE_KEYS.COMPLETIONS, JSON.stringify(completions));
};