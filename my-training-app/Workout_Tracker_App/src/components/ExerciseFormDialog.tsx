import { useState, useEffect } from 'react';
import { Exercise } from '../types/workout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ExerciseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise?: Exercise;
  onSave: (exercise: Exercise | Omit<Exercise, 'id'>) => void;
}

export function ExerciseFormDialog({
  open,
  onOpenChange,
  exercise,
  onSave,
}: ExerciseFormDialogProps) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (exercise) {
      setName(exercise.name);
      setImageUrl(exercise.imageUrl || '');
    } else {
      setName('');
      setImageUrl('');
    }
  }, [exercise, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (exercise) {
      onSave({ ...exercise, name, imageUrl: imageUrl || undefined });
    } else {
      onSave({ name, imageUrl: imageUrl || undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{exercise ? 'Edit Exercise' : 'Add Exercise'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Exercise Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Bench Press"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Enter image URL (optional)"
            />
            <p className="text-xs text-gray-500">
              Optional: Add an image URL to visualize the exercise
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{exercise ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
