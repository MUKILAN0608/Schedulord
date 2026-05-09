import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/authSlice';
import { loginUser, authApi } from '../api';

interface LoginPortalProps {
  role: 'admin' | 'client';
}

/** Full-bleed photo + light scrim so the background stays visible through glass UI */
function LoginPortalBackdrop({ imageUrl }: { imageUrl: string }) {
  return (
    <>
      <div
        className="absolute inset-0 z-0 bg-cover bg-center scale-[1.02]"
        style={{ backgroundImage: `url(${imageUrl})` }}
        aria-hidden
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-black/18 via-black/5 to-black/22 pointer-events-none" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_88%_68%_at_50%_42%,transparent_20%,rgba(0,0,0,0.14)_100%)] pointer-events-none" />
    </>
  )
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
  const portalInputClass =
    'w-full bg-white/[0.14] border border-white/20 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/45 focus:border-[#D4AF37]/55 transition-all'
  const clientLabelClass = 'block text-xs font-medium text-white/65'
  /** Gold titles: consistent with app accent, readable on photo backgrounds */
  const portalBrandClass =
    'text-[10px] sm:text-[11px] font-semibold text-[#D4AF37] tracking-[0.2em] uppercase'
  const portalHeadlineClass =
    'text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-[#D4AF37] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]'
  const portalSubtitleClass = 'text-white/55 text-sm mt-2.5 max-w-sm mx-auto leading-relaxed'
  /** Glass shell: transparent fill, strong edge + blur for a proper “container” */
  const portalShellClass =
    'relative w-full max-w-[min(100%,26rem)] sm:max-w-[28rem] rounded-2xl border border-white/20 bg-black/22 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/10 overflow-hidden'
  const portalShellAccent =
    'pointer-events-none absolute inset-x-10 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-[#D4AF37]/85 to-transparent'
  const portalBodyClass = 'px-7 pt-8 pb-7 sm:px-9 sm:pt-9 sm:pb-8'
  const portalFormPanelClass =
    'rounded-xl border border-white/18 bg-black/18 backdrop-blur-md p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'

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

  // ─── ADMIN: Login-only, centered panel ───────────────────────────────────────
  if (is_admin) {
    return (
      <div className="relative isolate min-h-[100dvh] w-full overflow-hidden flex items-center justify-center p-6 md:p-12 bg-neutral-950">
        <LoginPortalBackdrop imageUrl={bgImage} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full flex justify-center px-1 sm:px-4"
        >
          <div className={portalShellClass}>
            <div className={portalShellAccent} aria-hidden />
            <div className={`${portalBodyClass} relative z-10`}>
              <header className="text-center pb-6 mb-6 border-b border-[#D4AF37]/20">
                <p className={`${portalBrandClass} mb-3`}>Schedulord</p>
                <h1 className={portalHeadlineClass}>Administrator sign in</h1>
                <p className={portalSubtitleClass}>
                  Sign in to manage resources, requests, and approvals.
                </p>
              </header>

              <div className={`${portalFormPanelClass} relative`}>
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.03] to-transparent" aria-hidden />

                <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                  <div className="space-y-2">
                    <label htmlFor="admin-email" className="block text-xs font-medium text-white/65">Work email</label>
                    <input
                      id="admin-email"
                      type="email"
                      required
                      className={portalInputClass}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@organization.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="admin-password" className="block text-xs font-medium text-white/65">Password</label>
                    <input
                      id="admin-password"
                      type="password"
                      required
                      className={portalInputClass}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/15 border border-red-400/25 text-red-200 text-sm text-center">
                      {error}
                    </div>
                  )}

                  <button
                    id="admin-login-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#D4AF37] text-neutral-900 font-semibold text-sm rounded-lg hover:bg-[#e5c04a] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:ring-offset-2 focus:ring-offset-black/40 transition-colors disabled:opacity-50 flex items-center justify-center min-h-[48px]"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" /> : 'Sign in'}
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/10 text-center relative z-10">
                  <Link to="/" className="text-sm text-white/55 hover:text-white transition-colors">
                    Back to home
                  </Link>
                </div>
              </div>

              <p className="text-center text-white/45 text-xs mt-6 leading-relaxed">
                Need an account? Ask your organization administrator.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── CLIENT: Sign in + create account (centered card, same treatment as admin) ─
  return (
    <div className="relative isolate min-h-[100dvh] w-full overflow-hidden flex items-center justify-center p-6 md:p-12 bg-neutral-950">
      <LoginPortalBackdrop imageUrl={bgImage} />

      <motion.div
        key={isLogin ? 'client-login' : 'client-signup'}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full flex justify-center px-1 sm:px-4"
      >
        <div className={portalShellClass}>
          <div className={portalShellAccent} aria-hidden />
          <div className={`${portalBodyClass} relative z-10`}>
            <header className="text-center pb-6 mb-6 border-b border-[#D4AF37]/20">
              <p className={`${portalBrandClass} mb-3`}>Schedulord</p>
              <h1 className={portalHeadlineClass}>
                {isLogin ? 'Sign in' : 'Create account'}
              </h1>
              <p className={portalSubtitleClass}>
                {isLogin
                  ? 'Use your work email and password to continue.'
                  : 'Register to submit requests and follow allocation status.'}
              </p>
            </header>

            <div className={`${portalFormPanelClass} relative`}>
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.03] to-transparent" aria-hidden />

          {isLogin ? (
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div className="space-y-2">
                <label htmlFor="client-login-email" className={clientLabelClass}>Email</label>
                <input
                  id="client-login-email"
                  type="email"
                  required
                  className={portalInputClass}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="client-login-password" className={clientLabelClass}>Password</label>
                <input
                  id="client-login-password"
                  type="password"
                  required
                  className={portalInputClass}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-red-500/15 border border-red-400/25 text-red-200 text-sm text-center">
                  {error}
                </div>
              )}
              <button
                id="client-login-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#D4AF37] text-neutral-900 font-semibold text-sm rounded-lg hover:bg-[#e5c04a] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:ring-offset-2 focus:ring-offset-black/40 transition-colors disabled:opacity-50 flex items-center justify-center min-h-[48px]"
              >
                {loading ? <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" /> : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div className="space-y-2">
                <label htmlFor="client-signup-name" className={clientLabelClass}>Full name</label>
                <input
                  id="client-signup-name"
                  type="text"
                  required
                  className={portalInputClass}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="client-signup-email" className={clientLabelClass}>Email</label>
                <input
                  id="client-signup-email"
                  type="email"
                  required
                  className={portalInputClass}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="client-signup-password" className={clientLabelClass}>Password</label>
                <input
                  id="client-signup-password"
                  type="password"
                  required
                  className={portalInputClass}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Choose a strong password"
                />
                <div className="flex gap-1.5 h-1 w-full max-w-[180px] pt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-colors ${
                        i <= strength
                          ? strength > 2
                            ? 'bg-[#D4AF37]'
                            : 'bg-[#D4AF37]/55'
                          : 'bg-white/15'
                      }`}
                    />
                  ))}
                </div>
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-red-500/15 border border-red-400/25 text-red-200 text-sm text-center">
                  {error}
                </div>
              )}
              <button
                id="client-signup-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#D4AF37] text-neutral-900 font-semibold text-sm rounded-lg hover:bg-[#e5c04a] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:ring-offset-2 focus:ring-offset-black/40 transition-colors disabled:opacity-50 flex items-center justify-center min-h-[48px]"
              >
                {loading ? <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" /> : 'Create account'}
              </button>
            </form>
          )}

              <div className="mt-6 pt-6 border-t border-white/10 text-center relative z-10 space-y-3">
                {isLogin ? (
                  <button
                    type="button"
                    onClick={() => { setIsLogin(false); setError('') }}
                    className="text-sm text-white/80 hover:text-white transition-colors"
                  >
                    Create an account
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setIsLogin(true); setError('') }}
                    className="text-sm text-white/80 hover:text-white transition-colors"
                  >
                    Already have an account? Sign in
                  </button>
                )}
                <div>
                  <Link to="/" className="text-sm text-white/55 hover:text-white transition-colors">
                    Back to home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
};

export default LoginPortal;
