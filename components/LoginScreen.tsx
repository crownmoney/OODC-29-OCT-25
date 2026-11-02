import React, { useState } from 'react';
import { CrownLogo } from './common/IconComponents';
import { motion } from 'motion/react';
import { login } from '../services/api';

interface Props {
  onLoginSuccess: () => void;
}

// Single shared password. It is checked by the server (/api/login), so the
// password itself never appears in the website's code.
const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !password.trim()) return;
    setLoading(true);
    setError('');
    const result = await login(password);
    setLoading(false);
    if (result.ok) {
      onLoginSuccess();
    } else {
      setError(result.error || 'Incorrect password. Please try again.');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8F8F8] to-[#E6DEEE] p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-white/50 backdrop-blur-xl"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div whileHover={{ scale: 1.05 }} className="mb-6">
            <CrownLogo className="h-20 w-auto" />
          </motion.div>
          <h1 className="text-3xl font-black text-[#250B40] tracking-tight text-center">Out of Debt</h1>
          <p className="text-[#583d77] text-sm mt-2 font-bold uppercase tracking-[0.2em] opacity-60">
            Calculator Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-[#f8f6fb] p-5 rounded-2xl border border-[#d2c2e5]">
          <div className="space-y-2">
            <label htmlFor="password" className="block text-[10px] font-black text-[#250B40] uppercase tracking-[0.2em] ml-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-[#E6DEEE] rounded-xl focus:ring-4 focus:ring-[#5B21B6]/10 focus:border-[#5B21B6] transition-all outline-none text-[#250B40] font-bold"
              placeholder="Enter Password"
              autoComplete="current-password"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600 font-bold text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#5B21B6] text-white rounded-xl font-black text-sm shadow-md hover:bg-[#4c1d95] transition-all uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Login'}
          </button>
        </form>

        <div className="mt-8 text-center pt-4 border-t border-dashed border-[#E6DEEE]">
          <div className="inline-flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-[9px] text-[#583d77] uppercase tracking-[0.2em] font-black">Secure Portal</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
