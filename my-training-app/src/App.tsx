import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { BottomNav } from './components/BottomNav';
import { ExercisesScreen } from './components/ExercisesScreen';
import { WorkoutsScreen } from './components/WorkoutsScreen';
import { WeeklyScheduleScreen } from './components/WeeklyScheduleScreen';
import { WorkoutExecutionScreen } from './components/WorkoutExecutionScreen';
import { ExerciseExecutionScreen } from './components/ExerciseExecutionScreen';
import type { Exercise, Workout, WorkoutCompletion, ExerciseCompletion } from './types/workout';
import {
  getUser,
  saveUser,
  clearUser,
  setCurrentUser,
  getExercises,
  getWorkouts,
  getCompletions,
  workoutAPI,
} from './services/workoutApi';
import { Button } from './components/ui/button';
import { LogOut } from 'lucide-react';

type Screen = 
  | { type: 'tab'; tab: string }
  | { type: 'workout-execution'; workoutId: string }
  | { type: 'exercise-execution'; workoutId: string; exerciseId: string };

function App() {
  const [user, setUser] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);
  const [screen, setScreen] = useState<Screen>({ type: 'tab', tab: 'schedule' });

  // Load data from API on mount
  useEffect(() => {
    const savedUser = getUser();
    if (savedUser) {
      setUser(savedUser);
      // Configure the API with the saved user before loading data
      setCurrentUser(savedUser);
      loadData();
    }
  }, []);

  const loadData = async () => {
    try {
      console.log('Loading data for user...');
      const [exercisesData, workoutsData, completionsData] = await Promise.all([
        getExercises(),
        getWorkouts(),
        getCompletions(),
      ]);
      console.log('Data loaded:', { 
        exercises: exercisesData.length, 
        workouts: workoutsData.length, 
        completions: completionsData.length 
      });
      setExercises(exercisesData);
      setWorkouts(workoutsData);
      setCompletions(completionsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleLogin = async (username: string) => {
    try {
      saveUser(username); // Salva no localStorage e configura API
      setUser(username);
      await loadData(); // Carrega dados do usuário
    } catch (error) {
      console.error('Error during login:', error);
    }
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
    // Exercises são salvos individualmente via API nos componentes
  };

  const handleSaveWorkouts = (newWorkouts: Workout[]) => {
    setWorkouts(newWorkouts);
    // Workouts são salvos individualmente via API nos componentes
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
    // Completions são salvos individualmente via API
  };

  const handleBackFromWorkout = () => {
    setScreen({ type: 'tab', tab: 'schedule' });
  };

  const handleBackFromExercise = (workoutId: string) => {
    setScreen({ type: 'workout-execution', workoutId });
  };

  const handleCompleteAll = async (workoutId: string) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const today = new Date().toISOString().split('T')[0];
    
    // Criar completions para todos os exercícios
    const allExerciseCompletions: ExerciseCompletion[] = workout.exercises.map((we) => ({
      exerciseId: we.exerciseId,
      sets: Array.from({ length: we.sets }, () => ({
        reps: we.reps,
        weight: we.weight || 0,
        completed: true,
      })),
    }));

    const newCompletion: WorkoutCompletion = {
      workoutId,
      date: today,
      exercises: allExerciseCompletions,
      completed: true,
    };

    // Atualizar estado local
    const existingCompletionIndex = completions.findIndex(
      (c) => c.workoutId === workoutId && c.date === today
    );

    let updatedCompletions: WorkoutCompletion[];
    if (existingCompletionIndex >= 0) {
      updatedCompletions = [...completions];
      updatedCompletions[existingCompletionIndex] = newCompletion;
    } else {
      updatedCompletions = [...completions, newCompletion];
    }

    setCompletions(updatedCompletions);

    // Salvar no backend
    try {
      await workoutAPI.createCompletion(newCompletion);
      console.log('All exercises marked as completed!');
    } catch (error) {
      console.error('Error saving completion:', error);
    }
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
          onCompleteAll={() => handleCompleteAll(workout.id)}
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
          workoutId={workout.id}
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
          <h1 className="text-xl font-bold">Workout Tracker</h1>
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

export default App
