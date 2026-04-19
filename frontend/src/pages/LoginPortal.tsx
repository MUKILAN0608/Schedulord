import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/authSlice';
import { loginUser, authApi } from '../api';

interface LoginPortalProps {
  role: 'admin' | 'client';
}

const LoginPortal: React.FC<LoginPortalProps> = ({ role }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [strength, setStrength] = useState(0);
  const [isLogin, setIsLogin] = useState(true);
  
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const is_admin = role === 'admin';

  let bgImage = '';
  if (is_admin) {
    bgImage = isLogin ? '/admin_login.jpg' : '/admin_signin2.jpg';
  } else {
    bgImage = isLogin ? '/user_login2.webp' : '/user_signin2.jpg';
  }

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
      let data;
      if (isLogin) {
        data = await loginUser(email, password);
      } else {
        const assignedRole = role === 'admin' ? 'admin' : 'user';
        data = await authApi.register(name || 'Anonymous Operative', email, password, assignedRole);
      }
      
      // If registration returns valid credentials, log them in immediately.
      // If the backend requires email verification, this would need adjusting.
      if (data && data.token) {
        dispatch(setCredentials(data));
        navigate('/panel/dashboard');
      } else if (!isLogin) {
        // If registration succeeded but didn't auto-login (e.g. just returned a success message)
        setIsLogin(true);
        setError('Registration successful. Please verify identity.');
      }
    } catch (err: any) {
      setError(err.message || 'Identity verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#030303] overflow-hidden flex items-center justify-center md:p-8 lg:p-12">
      
      {/* Subtle Background Orbs for extreme depth */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none hidden md:block" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none hidden md:block" />

      {/* MOBILE TOP BANNER IMAGE */}
      <div className="absolute top-0 left-0 right-0 h-[50vh] md:hidden z-0 shadow-2xl">
        <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000" style={{ backgroundImage: `url(${bgImage})`, imageRendering: 'high-quality' }} />
        {/* Smooth fade to pure obsidian where the glass form sits */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030303] to-transparent" />
      </div>

      {/* LEFT SIDE: SIGNUP FORM */}
      <div className="w-full md:w-1/2 h-full flex flex-col items-center justify-end md:justify-center pb-6 md:pb-0 absolute inset-0 md:inset-auto md:left-0 md:top-0 z-10 pointer-events-none">
        <motion.div 
          animate={{ opacity: !isLogin ? 1 : 0, x: !isLogin ? 0 : -30, scale: !isLogin ? 1 : 0.95 }}
          transition={{ duration: 0.6 }}
          className={`w-full max-w-md relative z-10 px-4 md:px-0 pointer-events-auto mt-[40vh] md:mt-0 ${isLogin ? 'pointer-events-none' : ''}`}
        >
          <div className="bg-black/60 md:bg-black/40 backdrop-blur-3xl border border-purple-500/30 md:border-purple-500/20 rounded-[2rem] p-8 md:p-10 lg:p-14 shadow-[0_0_80px_rgba(168,85,247,0.4)] md:shadow-[0_0_80px_rgba(168,85,247,0.25)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
            
            <div className="mb-10 text-center relative z-10">
              <h1 className="text-3xl font-light tracking-[0.3em] uppercase text-white drop-shadow-md">
                <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-200 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                  {is_admin ? 'Admin' : 'User'}
                </span> Signup
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 relative z-10">
              <div className="relative">
                <label className="block text-[8px] font-black text-white/60 md:text-[#666] uppercase tracking-[0.3em] mb-2">Name</label>
                <input type="text" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light placeholder:text-white/20 md:placeholder:text-white/10" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter Name" />
              </div>
              <div className="relative">
                <label className="block text-[8px] font-black text-white/60 md:text-[#666] uppercase tracking-[0.3em] mb-2">Email Address</label>
                <input type="email" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light placeholder:text-white/20 md:placeholder:text-white/10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter Email" />
              </div>
              <div>
                <label className="block text-[8px] font-black text-white/60 md:text-[#666] uppercase tracking-[0.3em] mb-2">Password</label>
                <input type="password" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light mb-4 placeholder:text-white/20 md:placeholder:text-white/10 tracking-[0.2em]" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <div className="flex gap-1 h-[2px] w-full max-w-[150px]">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`flex-1 rounded-full transition-colors ${i <= strength ? (strength > 2 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]' : 'bg-purple-500/50') : 'bg-white/10 md:bg-white/5'}`} />
                  ))}
                </div>
              </div>
              {error && !isLogin && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] uppercase font-bold tracking-[0.2em] text-center">{error}</div>}
              
              <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)] md:shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_35px_rgba(234,179,8,0.5)] border border-yellow-300/50 hover:-translate-y-1 rounded-xl text-[10px] font-black tracking-[0.4em] uppercase disabled:opacity-50 mt-8 transition-all duration-300 flex justify-center items-center h-[56px]">
                {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'Create Account'}
              </button>
            </form>

            <div className="mt-8 md:mt-10 text-center relative z-10 pt-6 border-t border-white/10 md:border-white/5">
              <button type="button" onClick={() => { setIsLogin(true); setError(''); }} className="text-white/80 md:text-[#555] hover:text-yellow-500 text-[8px] font-black uppercase tracking-[0.3em] transition-colors">Return to Login →</button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* RIGHT SIDE: LOGIN FORM */}
      <div className="w-full md:w-1/2 h-full flex flex-col items-center justify-end md:justify-center pb-6 md:pb-0 absolute inset-0 md:inset-auto md:right-0 md:top-0 z-10 pointer-events-none">
        <motion.div 
          animate={{ opacity: isLogin ? 1 : 0, x: isLogin ? 0 : 30, scale: isLogin ? 1 : 0.95 }}
          transition={{ duration: 0.6 }}
          className={`w-full max-w-md relative z-10 px-4 md:px-0 pointer-events-auto mt-[40vh] md:mt-0 ${!isLogin ? 'pointer-events-none' : ''}`}
        >
          <div className="bg-black/60 md:bg-black/40 backdrop-blur-3xl border border-purple-500/30 md:border-purple-500/20 rounded-[2rem] p-8 md:p-10 lg:p-14 shadow-[0_0_80px_rgba(168,85,247,0.3)] md:shadow-[0_0_80px_rgba(168,85,247,0.25)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
            
            <div className="mb-10 text-center relative z-10">
              <h1 className="text-3xl font-light tracking-[0.3em] uppercase text-white drop-shadow-md">
                <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-200 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                  {is_admin ? 'Admin' : 'User'}
                </span> Login
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 relative z-10">
              <div className="relative">
                <label className="block text-[8px] font-black text-white/50 md:text-[#666] uppercase tracking-[0.3em] mb-2">Email Address</label>
                <input type="email" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light placeholder:text-white/20 md:placeholder:text-white/10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter Email" />
              </div>
              <div>
                <label className="block text-[8px] font-black text-white/50 md:text-[#666] uppercase tracking-[0.3em] mb-2">Password</label>
                <input type="password" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light mb-4 placeholder:text-white/20 md:placeholder:text-white/10 tracking-[0.2em]" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && isLogin && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] uppercase font-bold tracking-[0.2em] text-center">{error}</div>}
              
              <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)] md:shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_35px_rgba(234,179,8,0.5)] border border-yellow-300/50 hover:-translate-y-1 rounded-xl text-[10px] font-black tracking-[0.4em] uppercase disabled:opacity-50 mt-8 transition-all duration-300 flex justify-center items-center h-[56px]">
                {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'Login'}
              </button>
            </form>

            <div className="mt-8 md:mt-10 text-center relative z-10 pt-6 border-t border-white/10 md:border-white/5">
              <button type="button" onClick={() => { setIsLogin(false); setError(''); }} className="text-white/60 md:text-[#555] hover:text-yellow-500 text-[8px] font-black uppercase tracking-[0.3em] transition-colors">← Create Account</button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* DESKTOP FLOATING IMAGE OVERLAY - MASTERPIECE CSS */}
      <motion.div 
        animate={{ x: isLogin ? '0%' : '100%' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:block absolute top-8 bottom-8 left-8 w-[calc(50%-2rem)] z-20 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.9)] border border-white/[0.05]"
      >
        <div 
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700" 
          style={{ backgroundImage: `url(${bgImage})`, imageRendering: 'high-quality' }}
        />
      </motion.div>
    </div>
  );
};

export default LoginPortal;
