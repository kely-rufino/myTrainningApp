import { useState } from 'react';
import type { Exercise, WorkoutExercise, ExerciseCompletion, SetCompletion } from '../types/workout';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ArrowLeft, Check } from 'lucide-react';
import { saveExerciseProgress } from '../services/workoutApi';

interface ExerciseExecutionScreenProps {
  workoutId: string;
  exercise: Exercise;
  workoutExercise: WorkoutExercise;
  completion: ExerciseCompletion | null;
  onBack: () => void;
  onUpdateCompletion: (completion: ExerciseCompletion) => void;
}

export function ExerciseExecutionScreen({
  workoutId,
  exercise,
  workoutExercise,
  completion,
  onBack,
  onUpdateCompletion,
}: ExerciseExecutionScreenProps) {
  const [sets, setSets] = useState<SetCompletion[]>(() => {
    if (completion?.sets) {
      return completion.sets;
    }
    
    // Initialize with default values
    return Array.from({ length: workoutExercise.sets }, () => ({
      reps: workoutExercise.reps,
      weight: workoutExercise.weight || 0,
      completed: false,
    }));
  });

  const handleSetValueChange = async (index: number, field: 'reps' | 'weight', value: number) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setSets(newSets);
    
    try {
      // Salvar no banco de dados quando os valores mudam
      await saveExerciseProgress(workoutId, exercise.id, newSets);
    } catch (error) {
      console.error('Error saving exercise progress:', error);
    }
  };

  const handleSetComplete = async (index: number) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], completed: !newSets[index].completed };
    setSets(newSets);
    
    try {
      // Salvar no banco de dados
      await saveExerciseProgress(workoutId, exercise.id, newSets);
      
      // Auto-save completion (mantido para compatibilidade)
      const exerciseCompletion: ExerciseCompletion = {
        exerciseId: exercise.id,
        sets: newSets,
      };
      onUpdateCompletion(exerciseCompletion);
    } catch (error) {
      console.error('Error saving exercise progress:', error);
    }
  };

  const completedSets = sets.filter(set => set.completed).length;
  const totalSets = sets.length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{exercise.name}</h1>
            <p className="text-sm text-gray-600">
              {completedSets} of {totalSets} sets completed
            </p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="p-4">
        <div className="bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Instructions */}
      {workoutExercise.instructions && (
        <div className="px-4 pb-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-2">Instructions</h3>
              <p className="text-sm text-gray-600">{workoutExercise.instructions}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sets */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-3">
          {sets.map((set, index) => (
            <Card key={index} className={set.completed ? 'bg-green-50 border-green-200' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500 w-8">
                      Set {index + 1}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={set.reps}
                        onChange={(e) => handleSetValueChange(index, 'reps', parseInt(e.target.value) || 0)}
                        className="w-16 h-8 text-center"
                        disabled={set.completed}
                      />
                      <span className="text-xs text-gray-500">reps</span>
                    </div>
                    
                    <span className="text-gray-400">×</span>
                    
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.5"
                        value={set.weight}
                        onChange={(e) => handleSetValueChange(index, 'weight', parseFloat(e.target.value) || 0)}
                        className="w-16 h-8 text-center"
                        disabled={set.completed}
                      />
                      <span className="text-xs text-gray-500">kg</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleSetComplete(index)}
                    size="sm"
                    variant={set.completed ? "default" : "outline"}
                    className={set.completed ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Complete Exercise Button */}
      <div className="p-4 bg-white border-t">
        <Button
          onClick={onBack}
          className="w-full"
          disabled={completedSets === 0}
        >
          {completedSets === totalSets ? 'Exercise Complete!' : `Continue (${completedSets}/${totalSets} sets)`}
        </Button>
      </div>
    </div>
  );
}