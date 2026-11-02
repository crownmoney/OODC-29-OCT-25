import React, { useState } from 'react';
import { CrownLogo } from './common/IconComponents';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Lock, ShieldCheck, TrendingDown, Calculator, Sparkles } from 'lucide-react';
import { login } from '../services/api';

interface Props {
  onLoginSuccess: () => void;
}

const HIGHLIGHTS = [
  { icon: TrendingDown, text: 'Show clients their debt-free date and interest saved' },
  { icon: Calculator, text: 'Model loans, investments, expenses and future changes' },
  { icon: Sparkles, text: 'Ask Cody to explain any number in plain English' },
];

// Single shared password. It is checked by the server (/api/login), so the
// password itself never appears in the website's code.
const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

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
      setShakeKey(k => k + 1);
    }
  };

  const trackCapsLock = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8F8F8] via-[#F1ECF7] to-[#E6DEEE] p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden grid md:grid-cols-2"
      >
        {/* Brand panel (desktop) */}
        <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-[#250B40] via-[#3B1470] to-[#5B21B6] p-10 text-white">
          <div>
            <CrownLogo className="h-14 w-auto brightness-0 invert" />
            <h2 className="mt-10 text-3xl font-black leading-tight tracking-tight">
              Get your clients<br />out of debt, faster.
            </h2>
            <ul className="mt-8 space-y-4">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm text-white/85">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/50">Crown Money · Out of Debt Calculator</p>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-12 flex flex-col justify-center">
          <div className="md:hidden flex justify-center mb-6">
            <CrownLogo className="h-14 w-auto" />
          </div>
          <h1 className="text-3xl font-black text-[#250B40] tracking-tight text-center md:text-left">Welcome back</h1>
          <p className="mt-2 text-sm text-[#583d77] text-center md:text-left">
            Enter the team password to open the Out of Debt calculator.
          </p>

          <motion.form
            key={shakeKey}
            animate={shakeKey ? { x: [0, -10, 10, -6, 6, 0] } : {}}
            transition={{ duration: 0.4 }}
            onSubmit={handleSubmit}
            className="mt-8 space-y-4"
          >
            <div>
              <label htmlFor="password" className="block text-[11px] font-black text-[#250B40] uppercase tracking-[0.2em] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#583d77]/60" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                  onKeyDown={trackCapsLock}
                  onKeyUp={trackCapsLock}
                  className={`w-full pl-12 pr-12 py-3.5 bg-[#F8F8F8] border-2 rounded-xl focus:ring-4 focus:ring-[#5B21B6]/10 focus:border-[#5B21B6] focus:bg-white transition-all outline-none text-[#250B40] font-bold ${error ? 'border-red-300' : 'border-[#E6DEEE]'}`}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  aria-describedby="password-help"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#583d77] hover:bg-[#E6DEEE] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div id="password-help" className="min-h-[1.25rem] mt-2">
                <AnimatePresence mode="wait">
                  {error ? (
                    <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-red-600 font-semibold" role="alert">
                      {error}
                    </motion.p>
                  ) : capsLock ? (
                    <motion.p key="caps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-amber-600 font-semibold">
                      Caps Lock is on
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3.5 bg-[#5B21B6] text-white rounded-xl font-black text-sm shadow-lg shadow-[#5B21B6]/25 hover:bg-[#4c1d95] transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Checking…' : 'Log in'}
            </button>
          </motion.form>

          <div className="mt-8 flex items-center justify-center md:justify-start gap-2 text-[11px] text-[#583d77] font-bold uppercase tracking-[0.15em]">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            Secure portal · Crown Money staff only
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
