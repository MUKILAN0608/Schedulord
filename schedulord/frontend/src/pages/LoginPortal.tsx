import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/authSlice';
import { loginUser } from '../api';

interface LoginPortalProps {
  role: 'admin' | 'client';
}

const LoginPortal: React.FC<LoginPortalProps> = ({ role }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [strength, setStrength] = useState(0);
  
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const is_admin = role === 'admin';

  useEffect(() => {
    let score = 0;
    if (!password) { score = 0; }
    else {
      if (password.length > 8) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
    }
    setStrength(score);
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await loginUser(email, password);
      dispatch(setCredentials(data));
      navigate('/panel/dashboard');
    } catch (err: any) {
      setError(err.message || 'Identity verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian px-6">
      {/* Background Glow */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-gold/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-gold w-full max-w-md p-12 rounded-sm relative z-10"
      >
        <div className="mb-12 text-center">
          <Link to="/" className="text-gray-600 text-[9px] hover:text-gold mb-8 inline-block tracking-[0.4em] uppercase font-bold transition-colors">
            ← Secure Exit
          </Link>
          <div className="text-2xl font-bold tracking-[0.2em] mb-3 uppercase text-gold-gradient">
            {is_admin ? 'Elite Admin' : 'Secure Client'}
          </div>
          <p className="text-gray-500 text-[10px] uppercase tracking-widest font-medium">
            Authorized Personnel Only
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="relative group">
            <label className="block text-[9px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-3 group-focus-within:text-gold transition-colors">Identity Hash</label>
            <input
              type="email"
              required
              className="w-full bg-white/5 border border-white/5 rounded-none px-4 py-4 text-sm text-white focus:outline-none focus:border-gold/30 transition-all font-light tracking-wide"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="id@schedulord.enterprise"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-3">Security Sequence</label>
            <input
              type="password"
              required
              className="w-full bg-white/5 border border-white/5 rounded-none px-4 py-4 text-sm text-white focus:outline-none focus:border-gold/30 transition-all font-light tracking-wide mb-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            
            <div className="flex gap-1 h-1 mt-4">
              {[1, 2, 3, 4].map((i) => (
                <div 
                  key={i} 
                  className={`flex-1 strength-indicator ${
                    i <= strength ? `strength-${strength}` : ''
                  }`} 
                />
              ))}
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-500/5 border border-red-500/10 text-red-500 text-[10px] uppercase font-bold tracking-widest text-center">
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 gold-button rounded-none text-xs disabled:opacity-50"
          >
            {loading ? 'Decrypting Access...' : 'Verify Identity'}
          </button>
        </form>

        <div className="mt-12 text-center text-[9px] text-gray-700 tracking-widest">
            SECURE ACCESS SYSTEM V4.2
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPortal;
