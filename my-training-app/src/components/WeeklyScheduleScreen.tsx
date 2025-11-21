import type { Workout, WorkoutCompletion } from '../types/workout';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface WeeklyScheduleScreenProps {
  workouts: Workout[];
  completions: WorkoutCompletion[];
  onWorkoutClick: (workout: Workout) => void;
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

export function WeeklyScheduleScreen({
  workouts,
  completions,
  onWorkoutClick,
}: WeeklyScheduleScreenProps) {
  const today = new Date().getDay();
  const todayDate = new Date().toISOString().split('T')[0];

  const getWorkoutsForDay = (day: number) => {
    return workouts.filter((w) => w.daysOfWeek.includes(day));
  };

  const isWorkoutCompleted = (workoutId: string, date: string) => {
    return completions.some((c) => c.workoutId === workoutId && c.date === date && c.completed);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="space-y-4 max-w-screen-sm mx-auto">
          <h1 className="text-2xl font-bold">Weekly Schedule</h1>

          {workouts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">
                  No workouts scheduled. Create workouts and assign them to days of the week.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {DAYS.map((day) => {
                const dayWorkouts = getWorkoutsForDay(day.value);
                const isToday = day.value === today;

                return (
                  <Card
                    key={day.value}
                    className={isToday ? 'border-blue-500 border-2' : ''}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{day.label}</h3>
                          {isToday && (
                            <Badge variant="default" className="text-xs bg-blue-600">
                              Today
                            </Badge>
                          )}
                        </div>
                        {dayWorkouts.length > 0 && (
                          <span className="text-sm text-gray-500">
                            {dayWorkouts.length} workout{dayWorkouts.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {dayWorkouts.length === 0 ? (
                        <p className="text-sm text-gray-400">Rest day</p>
                      ) : (
                        <div className="space-y-2">
                          {dayWorkouts.map((workout) => {
                            const completed = isWorkoutCompleted(workout.id, todayDate);
                            return (
                              <button
                                key={workout.id}
                                onClick={() => onWorkoutClick(workout)}
                                className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{workout.name}</p>
                                    <p className="text-xs text-gray-600 mt-1">
                                      {workout.exercises.length} exercises
                                    </p>
                                  </div>
                                  {completed && (
                                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 ml-2" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}