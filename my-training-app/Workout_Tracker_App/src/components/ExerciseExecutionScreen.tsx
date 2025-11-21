import { useState, useEffect } from 'react';
import { Exercise, WorkoutExercise, ExerciseCompletion, SetCompletion } from '../types/workout';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { ChevronLeft, CheckCircle2, Dumbbell } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ExerciseExecutionScreenProps {
  exercise: Exercise;
  workoutExercise: WorkoutExercise;
  completion: ExerciseCompletion | null;
  onBack: () => void;
  onUpdateCompletion: (completion: ExerciseCompletion) => void;
}

export function ExerciseExecutionScreen({
  exercise,
  workoutExercise,
  completion,
  onBack,
  onUpdateCompletion,
}: ExerciseExecutionScreenProps) {
  const [sets, setSets] = useState<SetCompletion[]>([]);

  useEffect(() => {
    if (completion) {
      setSets(completion.sets);
    } else {
      // Initialize with planned values
      const initialSets: SetCompletion[] = [];
      for (let i = 0; i < workoutExercise.sets; i++) {
        initialSets.push({
          reps: workoutExercise.reps,
          weight: workoutExercise.weight || 0,
          completed: false,
        });
      }
      setSets(initialSets);
    }
  }, [completion, workoutExercise]);

  const handleUpdateSet = (index: number, updates: Partial<SetCompletion>) => {
    const updated = [...sets];
    updated[index] = { ...updated[index], ...updates };
    setSets(updated);
    onUpdateCompletion({
      exerciseId: workoutExercise.exerciseId,
      sets: updated,
    });
  };

  const allSetsCompleted = sets.every((set) => set.completed);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-screen-sm mx-auto p-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2>{exercise.name}</h2>
            {allSetsCompleted && (
              <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-4 h-4" />
                All sets completed!
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="max-w-screen-sm mx-auto space-y-4">
          {(exercise.imageUrl || workoutExercise.instructions) && (
            <Card>
              <CardContent className="p-4">
                {exercise.imageUrl ? (
                  <ImageWithFallback
                    src={exercise.imageUrl}
                    alt={exercise.name}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                ) : (
                  <div className="w-full h-48 rounded-lg bg-gray-100 flex flex-col items-center justify-center mb-4">
                    <Dumbbell className="w-16 h-16 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">{exercise.name}</p>
                  </div>
                )}
                {workoutExercise.instructions && (
                  <div>
                    <h3 className="text-sm mb-2">Instructions</h3>
                    <p className="text-sm text-gray-600">{workoutExercise.instructions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3>Sets ({sets.length})</h3>
                <p className="text-sm text-gray-600">
                  Target: {workoutExercise.sets} × {workoutExercise.reps} reps
                  {workoutExercise.weight ? ` @ ${workoutExercise.weight}kg` : ''}
                </p>
              </div>

              <div className="space-y-3">
                {sets.map((set, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      set.completed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 flex-shrink-0">
                        <span className="text-sm">{index + 1}</span>
                      </div>

                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Reps</label>
                          <Input
                            type="number"
                            min="0"
                            value={set.reps}
                            onChange={(e) =>
                              handleUpdateSet(index, {
                                reps: parseInt(e.target.value) || 0,
                              })
                            }
                            className="h-9"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Weight (kg)</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={set.weight}
                            onChange={(e) =>
                              handleUpdateSet(index, {
                                weight: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="flex items-center flex-shrink-0">
                        <Checkbox
                          id={`set-${index}`}
                          checked={set.completed}
                          onCheckedChange={(checked) =>
                            handleUpdateSet(index, { completed: checked === true })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
