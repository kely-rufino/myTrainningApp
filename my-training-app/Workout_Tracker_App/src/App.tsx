import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { BottomNav } from './components/BottomNav';
import { ExercisesScreen } from './components/ExercisesScreen';
import { WorkoutsScreen } from './components/WorkoutsScreen';
import { WeeklyScheduleScreen } from './components/WeeklyScheduleScreen';
import { WorkoutExecutionScreen } from './components/WorkoutExecutionScreen';
import { ExerciseExecutionScreen } from './components/ExerciseExecutionScreen';
import { Exercise, Workout, WorkoutCompletion, ExerciseCompletion } from './types/workout';
import {
  getUser,
  saveUser,
  clearUser,
  getExercises,
  saveExercises,
  getWorkouts,
  saveWorkouts,
  getCompletions,
  saveCompletions,
} from './utils/storage';
import { Button } from './components/ui/button';
import { LogOut } from 'lucide-react';

type Screen = 
  | { type: 'tab'; tab: string }
  | { type: 'workout-execution'; workoutId: string }
  | { type: 'exercise-execution'; workoutId: string; exerciseId: string };

export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);
  const [screen, setScreen] = useState<Screen>({ type: 'tab', tab: 'schedule' });

  // Load data from localStorage on mount
  useEffect(() => {
    const savedUser = getUser();
    if (savedUser) {
      setUser(savedUser);
      setExercises(getExercises());
      setWorkouts(getWorkouts());
      setCompletions(getCompletions());
    }
  }, []);

  const handleLogin = (username: string) => {
    saveUser(username);
    setUser(username);
  };

  const handleLogout = () => {
    clearUser();
    setUser(null);
    setExercises([]);
    setWorkouts([]);
    setCompletions([]);
  };

  const handleSaveExercises = (newExercises: Exercise[]) => {
    setExercises(newExercises);
    saveExercises(newExercises);
  };

  const handleSaveWorkouts = (newWorkouts: Workout[]) => {
    setWorkouts(newWorkouts);
    saveWorkouts(newWorkouts);
  };

  const handleWorkoutClick = (workout: Workout) => {
    setScreen({ type: 'workout-execution', workoutId: workout.id });
  };

  const handleExerciseClick = (workoutId: string, exerciseId: string) => {
    setScreen({ type: 'exercise-execution', workoutId, exerciseId });
  };

  const handleUpdateExerciseCompletion = (
    workoutId: string,
    exerciseCompletion: ExerciseCompletion
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const existingCompletionIndex = completions.findIndex(
      (c) => c.workoutId === workoutId && c.date === today
    );

    let updatedCompletions: WorkoutCompletion[];

    if (existingCompletionIndex >= 0) {
      // Update existing completion
      updatedCompletions = [...completions];
      const existingCompletion = updatedCompletions[existingCompletionIndex];
      const exerciseIndex = existingCompletion.exercises.findIndex(
        (e) => e.exerciseId === exerciseCompletion.exerciseId
      );

      if (exerciseIndex >= 0) {
        existingCompletion.exercises[exerciseIndex] = exerciseCompletion;
      } else {
        existingCompletion.exercises.push(exerciseCompletion);
      }

      // Check if all exercises are completed
      const workout = workouts.find((w) => w.id === workoutId);
      if (workout) {
        const allCompleted = workout.exercises.every((we) => {
          const ec = existingCompletion.exercises.find((e) => e.exerciseId === we.exerciseId);
          return ec && ec.sets.every((set) => set.completed);
        });
        existingCompletion.completed = allCompleted;
      }
    } else {
      // Create new completion
      const newCompletion: WorkoutCompletion = {
        workoutId,
        date: today,
        exercises: [exerciseCompletion],
        completed: false,
      };
      updatedCompletions = [...completions, newCompletion];
    }

    setCompletions(updatedCompletions);
    saveCompletions(updatedCompletions);
  };

  const handleBackFromWorkout = () => {
    setScreen({ type: 'tab', tab: 'schedule' });
  };

  const handleBackFromExercise = (workoutId: string) => {
    setScreen({ type: 'workout-execution', workoutId });
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Render workout execution screen
  if (screen.type === 'workout-execution') {
    const workout = workouts.find((w) => w.id === screen.workoutId);
    if (!workout) {
      setScreen({ type: 'tab', tab: 'schedule' });
      return null;
    }

    const today = new Date().toISOString().split('T')[0];
    const completion = completions.find(
      (c) => c.workoutId === workout.id && c.date === today
    );

    return (
      <div className="h-screen flex flex-col">
        <WorkoutExecutionScreen
          workout={workout}
          exercises={exercises}
          completion={completion || null}
          onBack={handleBackFromWorkout}
          onExerciseClick={(exerciseId) => handleExerciseClick(workout.id, exerciseId)}
        />
      </div>
    );
  }

  // Render exercise execution screen
  if (screen.type === 'exercise-execution') {
    const workout = workouts.find((w) => w.id === screen.workoutId);
    const workoutExercise = workout?.exercises.find((e) => e.exerciseId === screen.exerciseId);
    const exercise = exercises.find((e) => e.id === screen.exerciseId);

    if (!workout || !workoutExercise || !exercise) {
      setScreen({ type: 'workout-execution', workoutId: screen.workoutId });
      return null;
    }

    const today = new Date().toISOString().split('T')[0];
    const workoutCompletion = completions.find(
      (c) => c.workoutId === workout.id && c.date === today
    );
    const exerciseCompletion = workoutCompletion?.exercises.find(
      (e) => e.exerciseId === screen.exerciseId
    );

    return (
      <div className="h-screen flex flex-col">
        <ExerciseExecutionScreen
          exercise={exercise}
          workoutExercise={workoutExercise}
          completion={exerciseCompletion || null}
          onBack={() => handleBackFromExercise(workout.id)}
          onUpdateCompletion={(ec) => handleUpdateExerciseCompletion(workout.id, ec)}
        />
      </div>
    );
  }

  // Render main app with tabs
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-screen-sm mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl">Workout Tracker</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {screen.type === 'tab' && screen.tab === 'schedule' && (
          <WeeklyScheduleScreen
            workouts={workouts}
            completions={completions}
            onWorkoutClick={handleWorkoutClick}
          />
        )}
        {screen.type === 'tab' && screen.tab === 'exercises' && (
          <ExercisesScreen exercises={exercises} onSave={handleSaveExercises} />
        )}
        {screen.type === 'tab' && screen.tab === 'workouts' && (
          <WorkoutsScreen
            workouts={workouts}
            exercises={exercises}
            onSave={handleSaveWorkouts}
          />
        )}
      </div>

      <BottomNav
        activeTab={screen.type === 'tab' ? screen.tab : 'schedule'}
        onTabChange={(tab) => setScreen({ type: 'tab', tab })}
      />
    </div>
  );
}
