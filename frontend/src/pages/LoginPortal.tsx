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
  const bgImage = is_admin ? '/admin_login.jpg' : (isLogin ? '/user_login2.webp' : '/user_signin2.jpg');

  useEffect(() => {
    let score = 0;
    if (password) {
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
        data = await loginUser(email, password, is_admin ? 'admin' : 'user');
      } else {
        data = await authApi.register(name || 'User', email, password, 'user');
      }
      if (data && data.token) {
        dispatch(setCredentials(data));
        navigate('/panel/dashboard');
      } else if (!isLogin) {
        setIsLogin(true);
        setError('Account created. Please sign in.');
      }
    } catch (err: any) {
      setError(err.message || 'Identity verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── ADMIN: Login-only, clean centered panel ───────────────────────────────
  if (is_admin) {
    return (
      <div className="relative min-h-[100dvh] w-full bg-[#030303] overflow-hidden flex items-center justify-center p-6 md:p-12">
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${bgImage})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/80 via-transparent to-[#030303]/90" />
        <div className="absolute top-[-15%] right-[-5%] w-[50vw] h-[50vw] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[50vw] h-[50vw] bg-purple-900/8 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-[10px] font-black text-yellow-500/80 uppercase tracking-[0.3em]">Restricted Access</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white mb-2">
              Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-200">Vault</span>
            </h1>
            <p className="text-white/40 text-sm font-medium">Authorized personnel only. Credentials required.</p>
          </div>

          <div className="bg-black/50 backdrop-blur-3xl border border-yellow-500/10 rounded-3xl p-8 md:p-10 shadow-[0_0_80px_rgba(168,85,247,0.12)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none rounded-3xl" />
            
            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Email Address</label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yellow-500/40 focus:bg-white/[0.07] transition-all"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yellow-500/40 focus:bg-white/[0.07] transition-all tracking-widest"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold tracking-wide text-center">
                  {error}
                </div>
              )}

              <button
                id="admin-login-btn"
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-black font-black text-[11px] tracking-[0.3em] uppercase rounded-xl hover:shadow-[0_0_40px_rgba(234,179,8,0.4)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 flex items-center justify-center h-[52px]"
              >
                {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'Authenticate'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5 text-center relative z-10">
              <Link to="/" className="text-white/30 hover:text-white/60 text-[10px] uppercase tracking-[0.2em] font-bold transition-colors">
                ← Return to Gateway
              </Link>
            </div>
          </div>

          <p className="text-center text-white/20 text-[10px] mt-6 uppercase tracking-widest font-bold">
            Admin accounts are provisioned by existing administrators
          </p>
        </motion.div>
      </div>
    );
  }

  // ─── CLIENT: Login + Signup with image panel ───────────────────────────────
  return (
    <div className="relative min-h-[100dvh] w-full bg-[#030303] overflow-hidden flex items-center justify-center md:p-8 lg:p-12">
      
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none hidden md:block" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none hidden md:block" />

      {/* MOBILE TOP BANNER IMAGE */}
      <div className="absolute top-0 left-0 right-0 h-[50vh] md:hidden z-0 shadow-2xl">
        <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-700" style={{ backgroundImage: `url(${bgImage})` }} />
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
                  User
                </span> Signup
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 relative z-10">
              <div className="relative">
                <label className="block text-[8px] font-black text-white/60 md:text-[#666] uppercase tracking-[0.3em] mb-2">Name</label>
                <input id="client-signup-name" type="text" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light placeholder:text-white/20 md:placeholder:text-white/10" value={name} onChange={e => setName(e.target.value)} placeholder="Enter Name" />
              </div>
              <div className="relative">
                <label className="block text-[8px] font-black text-white/60 md:text-[#666] uppercase tracking-[0.3em] mb-2">Email Address</label>
                <input id="client-signup-email" type="email" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light placeholder:text-white/20 md:placeholder:text-white/10" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter Email" />
              </div>
              <div>
                <label className="block text-[8px] font-black text-white/60 md:text-[#666] uppercase tracking-[0.3em] mb-2">Password</label>
                <input id="client-signup-password" type="password" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light mb-4 placeholder:text-white/20 md:placeholder:text-white/10 tracking-[0.2em]" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                <div className="flex gap-1 h-[2px] w-full max-w-[150px]">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`flex-1 rounded-full transition-colors ${i <= strength ? (strength > 2 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]' : 'bg-purple-500/50') : 'bg-white/10 md:bg-white/5'}`} />
                  ))}
                </div>
              </div>
              {error && !isLogin && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] uppercase font-bold tracking-[0.2em] text-center">{error}</div>}
              
              <button id="client-signup-btn" type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_35px_rgba(234,179,8,0.5)] border border-yellow-300/50 hover:-translate-y-1 rounded-xl text-[10px] font-black tracking-[0.4em] uppercase disabled:opacity-50 mt-8 transition-all duration-300 flex justify-center items-center h-[56px]">
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
                  User
                </span> Login
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 relative z-10">
              <div className="relative">
                <label className="block text-[8px] font-black text-white/50 md:text-[#666] uppercase tracking-[0.3em] mb-2">Email Address</label>
                <input id="client-login-email" type="email" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light placeholder:text-white/20 md:placeholder:text-white/10" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter Email" />
              </div>
              <div>
                <label className="block text-[8px] font-black text-white/50 md:text-[#666] uppercase tracking-[0.3em] mb-2">Password</label>
                <input id="client-login-password" type="password" required className="w-full bg-transparent border-b border-white/20 md:border-white/10 px-2 py-3 text-lg text-white focus:outline-none focus:border-purple-400 transition-colors font-light mb-4 placeholder:text-white/20 md:placeholder:text-white/10 tracking-[0.2em]" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && isLogin && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] uppercase font-bold tracking-[0.2em] text-center">{error}</div>}
              
              <button id="client-login-btn" type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_35px_rgba(234,179,8,0.5)] border border-yellow-300/50 hover:-translate-y-1 rounded-xl text-[10px] font-black tracking-[0.4em] uppercase disabled:opacity-50 mt-8 transition-all duration-300 flex justify-center items-center h-[56px]">
                {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'Login'}
              </button>
            </form>

            <div className="mt-8 md:mt-10 text-center relative z-10 pt-6 border-t border-white/10 md:border-white/5">
              <button type="button" onClick={() => { setIsLogin(false); setError(''); }} className="text-white/60 md:text-[#555] hover:text-yellow-500 text-[8px] font-black uppercase tracking-[0.3em] transition-colors">← Create Account</button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* DESKTOP FLOATING IMAGE OVERLAY */}
      <motion.div 
        animate={{ x: isLogin ? '0%' : '100%' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:block absolute top-8 bottom-8 left-8 w-[calc(50%-2rem)] z-20 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.9)] border border-white/[0.05]"
      >
        <div 
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700" 
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      </motion.div>
    </div>
  );
};

export default LoginPortal;
