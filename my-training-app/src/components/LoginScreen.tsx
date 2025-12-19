import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';

interface LoginScreenProps {
  onLogin: (username: string, password: string, isRegister: boolean) => Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim() && !isLoading) {
      setIsLoading(true);
      setError('');
      try {
        console.log('Attempting', isRegisterMode ? 'registration' : 'login', 'for user:', username);
        await onLogin(username.trim(), password, isRegisterMode);
      } catch (error: any) {
        console.error('Login/Register error:', error);
        const errorMsg = error.message || 'Authentication failed. Please try again.';
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Workout Tracker</CardTitle>
          <p className="text-gray-600">
            {isRegisterMode ? 'Create your account' : 'Login to continue'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm text-center">
                {error}
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!username.trim() || !password.trim() || isLoading}
            >
              {isLoading 
                ? 'Please wait...' 
                : isRegisterMode 
                  ? 'Create Account' 
                  : 'Login'}
            </Button>
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-blue-600 hover:underline"
              >
                {isRegisterMode 
                  ? 'Already have an account? Login' 
                  : "Don't have an account? Register"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}