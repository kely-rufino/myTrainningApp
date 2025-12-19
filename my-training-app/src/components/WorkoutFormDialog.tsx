import { useState, useEffect, useRef } from 'react';
import type { Workout, Exercise, WorkoutExercise } from '../types/workout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent } from './ui/card';
import { Plus, Trash2, Search } from 'lucide-react';
import { workoutAPI } from '../services/workoutApi';

interface WorkoutFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout?: Workout;
  exercises: Exercise[];
  onSave: (workout: Workout | Omit<Workout, 'id'>) => void;
  loading?: boolean;
}

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function WorkoutFormDialog({
  open,
  onOpenChange,
  workout,
  exercises,
  onSave,
  loading = false,
}: WorkoutFormDialogProps) {
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [exerciseSuggestions, setExerciseSuggestions] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>(exercises);

  // Atualizar lista de exercícios quando props mudar
  useEffect(() => {
    setAllExercises(exercises);
  }, [exercises]);

  // Buscar sugestões quando termo de busca mudar
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.trim().length > 0) {
        try {
          const results = await workoutAPI.getExerciseSuggestions(searchTerm);
          setExerciseSuggestions(results);
          setAllExercises(results);
        } catch (err) {
          console.error('Failed to fetch suggestions:', err);
        }
      } else {
        setAllExercises(exercises);
        setExerciseSuggestions([]);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, exercises]);

  useEffect(() => {
    if (workout) {
      setName(workout.name);
      setInstructions(workout.instructions);
      setWorkoutExercises(workout.exercises);
      setDaysOfWeek(workout.daysOfWeek);
    } else {
      setName('');
      setInstructions('');
      setWorkoutExercises([]);
      setDaysOfWeek([]);
    }
  }, [workout, open]);

  const handleAddExercise = () => {
    if (allExercises.length === 0) return;
    setWorkoutExercises([
      ...workoutExercises,
      {
        exerciseId: allExercises[0].id,
        instructions: '',
        sets: 3,
        reps: 10,
        weight: 0,
      },
    ]);
  };

  const handleRemoveExercise = (index: number) => {
    setWorkoutExercises(workoutExercises.filter((_, i) => i !== index));
  };

  const handleUpdateExercise = (index: number, updates: Partial<WorkoutExercise>) => {
    const updated = [...workoutExercises];
    updated[index] = { ...updated[index], ...updates };
    setWorkoutExercises(updated);
  };

  const handleToggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort((a, b) => a - b));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (workout) {
      onSave({ ...workout, name, instructions, exercises: workoutExercises, daysOfWeek });
    } else {
      onSave({ name, instructions, exercises: workoutExercises, daysOfWeek });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{workout ? 'Edit Workout' : 'Create Workout'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Workout Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Upper Body Strength"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Describe the workout plan and general instructions..."
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Exercises</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddExercise}
                    disabled={allExercises.length === 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Exercise
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {allExercises.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No exercises available. Create exercises first.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {workoutExercises.map((we, index) => (
                      <Card key={index}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 space-y-3">
                              <Select
                                value={we.exerciseId}
                                onValueChange={(value) =>
                                  handleUpdateExercise(index, { exerciseId: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {allExercises.map((ex) => (
                                    <SelectItem key={ex.id} value={ex.id}>
                                      {ex.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Textarea
                                value={we.instructions}
                                onChange={(e) =>
                                  handleUpdateExercise(index, { instructions: e.target.value })
                                }
                                placeholder="Exercise-specific instructions..."
                                rows={2}
                              />

                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Sets</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={we.sets}
                                    onChange={(e) =>
                                      handleUpdateExercise(index, {
                                        sets: parseInt(e.target.value) || 1,
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Reps</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={we.reps}
                                    onChange={(e) =>
                                      handleUpdateExercise(index, {
                                        reps: parseInt(e.target.value) || 1,
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Weight (kg)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={we.weight || 0}
                                    onChange={(e) =>
                                      handleUpdateExercise(index, {
                                        weight: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveExercise(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>Days of Week</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DAYS.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={daysOfWeek.includes(day.value)}
                        onCheckedChange={() => handleToggleDay(day.value)}
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className="cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4 flex justify-end gap-2 bg-yellow-100">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || daysOfWeek.length === 0}>
              {loading ? 'Saving...' : (workout ? 'Save' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}