import { useState } from 'react';
import type { Workout, Exercise } from '../types/workout';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { WorkoutFormDialog } from './WorkoutFormDialog';

interface WorkoutsScreenProps {
  workouts: Workout[];
  exercises: Exercise[];
  onSave: (workouts: Workout[]) => void;
}

const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export function WorkoutsScreen({ workouts, exercises, onSave }: WorkoutsScreenProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);

  const handleAdd = (workout: Omit<Workout, 'id'>) => {
    const newWorkout: Workout = {
      ...workout,
      id: Date.now().toString(),
    };
    onSave([...workouts, newWorkout]);
    setIsFormOpen(false);
  };

  const handleEdit = (workout: Workout) => {
    const updated = workouts.map((w) => (w.id === workout.id ? workout : w));
    onSave(updated);
    setEditingWorkout(null);
  };

  const handleDelete = (id: string) => {
    onSave(workouts.filter(w => w.id !== id));
  };

  const getDayNames = (days: number[]) => {
    return days.map(day => DAYS.find(d => d.value === day)?.short).join(', ');
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          <div className="space-y-4 max-w-screen-sm mx-auto">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Workouts</h1>
              <Button
                onClick={() => setIsFormOpen(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Workout
              </Button>
            </div>

            {workouts.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-500">
                    No workouts created yet. Add your first workout to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {workouts.map((workout) => (
                  <Card key={workout.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium">{workout.name}</h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {workout.instructions}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <p className="text-xs text-gray-600">
                              {workout.exercises.length} exercises
                            </p>
                            <p className="text-xs text-gray-600">
                              Days: {getDayNames(workout.daysOfWeek)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingWorkout(workout)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(workout.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Dialog for Add */}
      <WorkoutFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        exercises={exercises}
        onSave={handleAdd}
      />

      {/* Form Dialog for Edit */}
      <WorkoutFormDialog
        open={!!editingWorkout}
        onOpenChange={(open) => !open && setEditingWorkout(null)}
        workout={editingWorkout || undefined}
        exercises={exercises}
        onSave={(workout) => {
          if ('id' in workout) {
            handleEdit(workout);
          }
        }}
      />
    </>
  );
}