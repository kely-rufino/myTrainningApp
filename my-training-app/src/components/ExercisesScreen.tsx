import { useState } from 'react';
import type { Exercise } from '../types/workout';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { workoutAPI } from '../services/workoutApi';

interface ExercisesScreenProps {
  exercises: Exercise[];
  onSave: (exercises: Exercise[]) => void;
}

export function ExercisesScreen({ exercises, onSave }: ExercisesScreenProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (newExerciseName.trim()) {
      setLoading(true);
      setError(null);
      try {
        const newExercise: Exercise = {
          id: Date.now().toString(),
          name: newExerciseName.trim(),
        };
        await workoutAPI.createExercise(newExercise);
        onSave([...exercises, newExercise]);
        setNewExerciseName('');
        setIsAdding(false);
      } catch (err) {
        setError('Failed to create exercise: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await workoutAPI.deleteExercise(id);
      onSave(exercises.filter(e => e.id !== id));
    } catch (err) {
      setError('Failed to delete exercise: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (id: string, newName: string) => {
    if (newName.trim()) {
      setLoading(true);
      setError(null);
      try {
        await workoutAPI.updateExercise(id, { name: newName.trim() });
        onSave(exercises.map(e => e.id === id ? { ...e, name: newName.trim() } : e));
        setEditingId(null);
      } catch (err) {
        setError('Failed to update exercise: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
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

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <p className="text-red-600 text-sm">{error}</p>
                <Button 
                  onClick={() => setError(null)} 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2"
                >
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          )}

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
                    disabled={loading}
                  />
                  <Button onClick={handleAdd} size="sm" disabled={loading}>
                    {loading ? 'Adding...' : 'Add'}
                  </Button>
                  <Button 
                    onClick={() => {
                      setIsAdding(false);
                      setNewExerciseName('');
                      setError(null);
                    }} 
                    variant="outline" 
                    size="sm"
                    disabled={loading}
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
                          disabled={loading}
                        />
                        <Button 
                          onClick={() => setEditingId(null)}
                          variant="outline"
                          size="sm"
                          disabled={loading}
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
                            disabled={loading}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(exercise.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={loading}
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