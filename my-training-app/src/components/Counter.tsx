import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, MinusIcon, ResetIcon, ReloadIcon } from '@radix-ui/react-icons';
import { counterApi } from '../services/counterApi';
import type { CounterResponse } from '../services/counterApi';
import clsx from 'clsx';

interface CounterProps {
  className?: string;
}

export function Counter({ className }: CounterProps) {
  const [counter, setCounter] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Função para mostrar feedback temporário
  const showFeedback = (message: string, isError = false) => {
    if (isError) {
      setError(message);
      setSuccess(null);
      setTimeout(() => setError(null), 3000);
    } else {
      setSuccess(message);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  // Fetch initial counter
  const fetchCounter = useCallback(async () => {
    setLoading(true);
    try {
      const response: CounterResponse = await counterApi.getCounter();
      if (response.success) {
        setCounter(response.data.count);
        setLastUpdated(response.data.lastUpdated);
        showFeedback('Counter loaded successfully!');
      } else {
        showFeedback(response.message, true);
      }
    } catch {
      showFeedback('Error loading counter', true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Increment counter
  const handleIncrement = async () => {
    setLoading(true);
    try {
      const response: CounterResponse = await counterApi.incrementCounter();
      if (response.success) {
        setCounter(response.data.count);
        setLastUpdated(response.data.lastUpdated);
        showFeedback('Counter incremented!');
      } else {
        showFeedback(response.message, true);
      }
    } catch {
      showFeedback('Error incrementing counter', true);
    } finally {
      setLoading(false);
    }
  };

  // Decrement counter
  const handleDecrement = async () => {
    setLoading(true);
    try {
      const response: CounterResponse = await counterApi.decrementCounter();
      if (response.success) {
        setCounter(response.data.count);
        setLastUpdated(response.data.lastUpdated);
        showFeedback('Counter decremented!');
      } else {
        showFeedback(response.message, true);
      }
    } catch {
      showFeedback('Error decrementing counter', true);
    } finally {
      setLoading(false);
    }
  };

  // Reset counter
  const handleReset = async () => {
    setLoading(true);
    try {
      const response: CounterResponse = await counterApi.resetCounter();
      if (response.success) {
        setCounter(response.data.count);
        setLastUpdated(response.data.lastUpdated);
        showFeedback('Counter reset!');
      } else {
        showFeedback(response.message, true);
      }
    } catch {
      showFeedback('Error resetting counter', true);
    } finally {
      setLoading(false);
    }
  };

  // Load counter when component mounts
  useEffect(() => {
    fetchCounter();
  }, [fetchCounter]);

  return (
    <div className={clsx(
      'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700',
      'max-w-md mx-auto space-y-6',
      className
    )}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Counter API Test
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          Endpoint testing with React + Vite + Tailwind
        </p>
      </div>

      {/* Counter Display */}
      <div className="text-center py-8 bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-700 dark:to-gray-600 rounded-lg">
        <div className="text-6xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
          {loading ? (
            <ReloadIcon className="animate-spin w-16 h-16 mx-auto" />
          ) : (
            counter
          )}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {lastUpdated && (
            <>Last updated: {new Date(lastUpdated).toLocaleTimeString('en-US')}</>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleDecrement}
          disabled={loading}
          className={clsx(
            'flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
            'bg-red-500 hover:bg-red-600 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transform hover:scale-105 active:scale-95'
          )}
        >
          <MinusIcon className="w-4 h-4" />
          Decrement
        </button>

        <button
          onClick={handleIncrement}
          disabled={loading}
          className={clsx(
            'flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
            'bg-green-500 hover:bg-green-600 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transform hover:scale-105 active:scale-95'
          )}
        >
          <PlusIcon className="w-4 h-4" />
          Increment
        </button>
      </div>

      {/* Reset and Reload Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleReset}
          disabled={loading}
          className={clsx(
            'flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
            'bg-orange-500 hover:bg-orange-600 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <ResetIcon className="w-4 h-4" />
          Reset
        </button>

        <button
          onClick={fetchCounter}
          disabled={loading}
          className={clsx(
            'flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
            'bg-blue-500 hover:bg-blue-600 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <ReloadIcon className={clsx('w-4 h-4', loading && 'animate-spin')} />
          Reload
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
          <p className="text-red-700 dark:text-red-300 text-sm font-medium">
            ❌ {error}
          </p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
          <p className="text-green-700 dark:text-green-300 text-sm font-medium">
            ✅ {success}
          </p>
        </div>
      )}

      {/* API Status */}
      <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-center gap-2 text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-gray-600 dark:text-gray-400">
            API Status: Online
          </span>
        </div>
      </div>
    </div>
  );
}