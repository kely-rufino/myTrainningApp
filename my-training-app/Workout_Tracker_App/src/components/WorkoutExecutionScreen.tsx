import { Workout, Exercise, WorkoutCompletion, ExerciseCompletion } from '../types/workout';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ChevronLeft, CheckCircle2, Dumbbell } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface WorkoutExecutionScreenProps {
  workout: Workout;
  exercises: Exercise[];
  completion: WorkoutCompletion | null;
  onBack: () => void;
  onExerciseClick: (exerciseId: string) => void;
}

export function WorkoutExecutionScreen({
  workout,
  exercises,
  completion,
  onBack,
  onExerciseClick,
}: WorkoutExecutionScreenProps) {
  const getExerciseById = (id: string) => {
    return exercises.find((e) => e.id === id);
  };

  const isExerciseCompleted = (exerciseId: string) => {
    if (!completion) return false;
    const exerciseCompletion = completion.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exerciseCompletion) return false;
    return exerciseCompletion.sets.every((set) => set.completed);
  };

  const allExercisesCompleted = workout.exercises.every((we) =>
    isExerciseCompleted(we.exerciseId)
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-screen-sm mx-auto p-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2>{workout.name}</h2>
            {allExercisesCompleted && (
              <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-4 h-4" />
                Workout completed!
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="max-w-screen-sm mx-auto space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm mb-2">Instructions</h3>
              <p className="text-sm text-gray-600">{workout.instructions}</p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3>Exercises ({workout.exercises.length})</h3>
            {workout.exercises.map((we, index) => {
              const exercise = getExerciseById(we.exerciseId);
              if (!exercise) return null;

              const completed = isExerciseCompleted(we.exerciseId);

              return (
                <Card key={we.exerciseId}>
                  <CardContent className="p-0">
                    <button
                      onClick={() => onExerciseClick(we.exerciseId)}
                      className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex gap-3 items-center">
                        {exercise.imageUrl ? (
                          <div className="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
                            <ImageWithFallback
                              src={exercise.imageUrl}
                              alt={exercise.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Dumbbell className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-gray-200 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                              {index + 1}
                            </span>
                            <h4 className="truncate">{exercise.name}</h4>
                          </div>
                          <p className="text-sm text-gray-600">
                            {we.sets} sets × {we.reps} reps
                            {we.weight ? ` @ ${we.weight}kg` : ''}
                          </p>
                          {we.instructions && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              {we.instructions}
                            </p>
                          )}
                        </div>
                        {completed && (
                          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
