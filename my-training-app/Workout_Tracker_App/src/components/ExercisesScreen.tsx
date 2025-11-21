import { useState } from 'react';
import { Exercise } from '../types/workout';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Plus, Pencil, Trash2, Dumbbell } from 'lucide-react';
import { ExerciseFormDialog } from './ExerciseFormDialog';
import { ImageWithFallback } from './figma/ImageWithFallback';
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

interface ExercisesScreenProps {
  exercises: Exercise[];
  onSave: (exercises: Exercise[]) => void;
}

export function ExercisesScreen({ exercises, onSave }: ExercisesScreenProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = (exercise: Omit<Exercise, 'id'>) => {
    const newExercise: Exercise = {
      ...exercise,
      id: Date.now().toString(),
    };
    onSave([...exercises, newExercise]);
    setIsFormOpen(false);
  };

  const handleEdit = (exercise: Exercise) => {
    const updated = exercises.map((ex) => (ex.id === exercise.id ? exercise : ex));
    onSave(updated);
    setEditingExercise(null);
  };

  const handleDelete = (id: string) => {
    const updated = exercises.filter((ex) => ex.id !== id);
    onSave(updated);
    setDeletingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="space-y-4 max-w-screen-sm mx-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">Exercises</h1>
            <Button onClick={() => setIsFormOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Exercise
            </Button>
          </div>

          {exercises.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">
                  No exercises yet. Add your first exercise to get started!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {exercises.map((exercise) => (
                <Card key={exercise.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {exercise.imageUrl ? (
                        <ImageWithFallback
                          src={exercise.imageUrl}
                          alt={exercise.name}
                          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Dumbbell className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate">{exercise.name}</h3>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingExercise(exercise)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingId(exercise.id)}
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

      <ExerciseFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleAdd}
      />

      {editingExercise && (
        <ExerciseFormDialog
          open={true}
          onOpenChange={(open) => !open && setEditingExercise(null)}
          exercise={editingExercise}
          onSave={handleEdit}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this exercise? This action cannot be undone.
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
