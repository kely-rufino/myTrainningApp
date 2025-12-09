import type { Workout, Exercise, WorkoutCompletion } from '../types/workout';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, Play, CheckCircle2, CheckCheck } from 'lucide-react';

interface WorkoutExecutionScreenProps {
  workout: Workout;
  exercises: Exercise[];
  completion: WorkoutCompletion | null;
  onBack: () => void;
  onExerciseClick: (exerciseId: string) => void;
  onCompleteAll: () => void;
}

export function WorkoutExecutionScreen({
  workout,
  exercises,
  completion,
  onBack,
  onExerciseClick,
  onCompleteAll,
}: WorkoutExecutionScreenProps) {
  const getExerciseName = (exerciseId: string) => {
    return exercises.find(e => e.id === exerciseId)?.name || 'Unknown Exercise';
  };

  const isExerciseCompleted = (exerciseId: string) => {
    if (!completion) return false;
    const exerciseCompletion = completion.exercises.find(e => e.exerciseId === exerciseId);
    return exerciseCompletion?.sets.every(set => set.completed) || false;
  };

  const completedCount = workout.exercises.filter(we => isExerciseCompleted(we.exerciseId)).length;
  const totalCount = workout.exercises.length;
  const allCompleted = completedCount === totalCount && totalCount > 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{workout.name}</h1>
            <p className="text-sm text-gray-600">
              {completedCount} of {totalCount} exercises completed
            </p>
          </div>
          <Button
            onClick={onCompleteAll}
            size="sm"
            variant={allCompleted ? "outline" : "default"}
            className={allCompleted ? "text-green-600 border-green-600" : "bg-green-600 hover:bg-green-700"}
            disabled={allCompleted}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            {allCompleted ? 'All Done' : 'Complete All'}
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="p-4">
        <div className="bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Instructions */}
      {workout.instructions && (
        <div className="px-4 pb-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-2">Instructions</h3>
              <p className="text-sm text-gray-600">{workout.instructions}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Exercises */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-3">
          {workout.exercises.map((workoutExercise, index) => {
            const exerciseName = getExerciseName(workoutExercise.exerciseId);
            const isCompleted = isExerciseCompleted(workoutExercise.exerciseId);

            return (
              <Card key={workoutExercise.exerciseId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">
                          {index + 1}.
                        </span>
                        <h3 className="font-medium">{exerciseName}</h3>
                        {isCompleted && (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {workoutExercise.sets} sets × {workoutExercise.reps} reps
                        {workoutExercise.weight && ` @ ${workoutExercise.weight}kg`}
                      </div>
                      {workoutExercise.instructions && (
                        <p className="text-xs text-gray-500 mt-1">
                          {workoutExercise.instructions}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => onExerciseClick(workoutExercise.exerciseId)}
                      size="sm"
                      variant={isCompleted ? "outline" : "default"}
                      className={isCompleted ? "text-green-600" : ""}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {isCompleted ? 'Review' : 'Start'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}