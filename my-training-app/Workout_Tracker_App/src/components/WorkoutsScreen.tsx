import { useState } from 'react';
import { Workout, Exercise } from '../types/workout';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { WorkoutFormDialog } from './WorkoutFormDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Badge } from './ui/badge';

interface WorkoutsScreenProps {
  workouts: Workout[];
  exercises: Exercise[];
  onSave: (workouts: Workout[]) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WorkoutsScreen({ workouts, exercises, onSave }: WorkoutsScreenProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    const updated = workouts.filter((w) => w.id !== id);
    onSave(updated);
    setDeletingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="space-y-4 max-w-screen-sm mx-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">Workouts</h1>
            <Button onClick={() => setIsFormOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Workout
            </Button>
          </div>

          {workouts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">
                  No workouts yet. Create your first workout plan!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {workouts.map((workout) => (
                <Card key={workout.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3>{workout.name}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                          {workout.instructions}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingWorkout(workout)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingId(workout.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="text-gray-600">Exercises:</span>{' '}
                        {workout.exercises.length}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {workout.daysOfWeek.map((day) => (
                          <Badge key={day} variant="secondary">
                            {DAYS[day]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <WorkoutFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        exercises={exercises}
        onSave={handleAdd}
      />

      {editingWorkout && (
        <WorkoutFormDialog
          open={true}
          onOpenChange={(open) => !open && setEditingWorkout(null)}
          workout={editingWorkout}
          exercises={exercises}
          onSave={handleEdit}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workout? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && handleDelete(deletingId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
