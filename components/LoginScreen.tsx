import React, { useState } from 'react';
import { CrownLogo } from './common/IconComponents';
import { login } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !password) return;
    setLoading(true);
    const result = await login(password);
    setLoading(false);
    if (result.ok) {
      setError('');
      onLoginSuccess();
    } else {
      setError(result.error || 'Incorrect password. Please try again.');
      setPassword('');
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center text-[var(--text-color)] p-4 font-sans animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
            <CrownLogo className="h-16 w-auto mx-auto text-[var(--text-color)]" />
        </div>
        <div className="bg-[var(--card-bg-color)] border border-[var(--border-color)] rounded-xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-center text-[var(--title-color)] mb-1">Access Required</h2>
            <p className="text-center text-sm text-[var(--text-color-muted)] mb-6">Please enter the password to continue.</p>
            <form onSubmit={handleSubmit} noValidate>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[var(--input-bg-color)] p-2 rounded-md border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]"
                            autoFocus
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-400 text-center">{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full p-2 bg-[var(--button-bg-color)] text-white rounded-md font-semibold hover:bg-[var(--button-bg-hover-color)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--title-color)]"
                    >
                        {loading ? 'Checking…' : 'Unlock'}
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
