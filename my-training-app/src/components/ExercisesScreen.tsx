import { useState } from 'react';
import type { Exercise } from '../types/workout';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Plus, Trash2, Edit2 } from 'lucide-react';

interface ExercisesScreenProps {
  exercises: Exercise[];
  onSave: (exercises: Exercise[]) => void;
}

export function ExercisesScreen({ exercises, onSave }: ExercisesScreenProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');

  const handleAdd = () => {
    if (newExerciseName.trim()) {
      const newExercise: Exercise = {
        id: Date.now().toString(),
        name: newExerciseName.trim(),
      };
      onSave([...exercises, newExercise]);
      setNewExerciseName('');
      setIsAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    onSave(exercises.filter(e => e.id !== id));
  };

  const handleEdit = (id: string, newName: string) => {
    if (newName.trim()) {
      onSave(exercises.map(e => e.id === id ? { ...e, name: newName.trim() } : e));
      setEditingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="space-y-4 max-w-screen-sm mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Exercises</h1>
            <Button
              onClick={() => setIsAdding(true)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Exercise
            </Button>
          </div>

          {isAdding && (
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Exercise name"
                    value={newExerciseName}
                    onChange={(e) => setNewExerciseName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                    autoFocus
                  />
                  <Button onClick={handleAdd} size="sm">
                    Add
                  </Button>
                  <Button 
                    onClick={() => {
                      setIsAdding(false);
                      setNewExerciseName('');
                    }} 
                    variant="outline" 
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {exercises.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">
                  No exercises created yet. Add your first exercise to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {exercises.map((exercise) => (
                <Card key={exercise.id}>
                  <CardContent className="p-4">
                    {editingId === exercise.id ? (
                      <div className="flex gap-2">
                        <Input
                          defaultValue={exercise.name}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleEdit(exercise.id, (e.target as HTMLInputElement).value);
                            }
                          }}
                          onBlur={(e) => handleEdit(exercise.id, e.target.value)}
                          autoFocus
                        />
                        <Button 
                          onClick={() => setEditingId(null)}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{exercise.name}</span>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setEditingId(exercise.id)}
                            variant="ghost"
                            size="sm"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(exercise.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}