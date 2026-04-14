import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { motion } from 'framer-motion'
import { authApi, setToken, setStoredUser } from '../api'
import { setUser } from '../store/authSlice'
import { connectSocket } from '../socket'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const fn = isRegister ? authApi.register : authApi.login
      const res = await fn(email, password)
      setToken(res.token)
      setStoredUser(res.user)
      dispatch(setUser(res.user))
      connectSocket(res.token)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-dark-900)] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--color-accent-primary)] opacity-5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--color-neon-cyan)] opacity-5 rounded-full blur-3xl" />
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(108,92,231,0.08) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card glow-border p-8 w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold gradient-text tracking-wider mb-2">SCHEDULORD</h1>
          <p className="text-sm text-[#636380] font-mono">Autonomous Resource Orchestration Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#8888a0] mb-2 uppercase tracking-wider">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="admin@schedulord.local"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8888a0] mb-2 uppercase tracking-wider">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-[var(--color-neon-red)] bg-[rgba(255,82,82,0.1)] rounded-lg px-4 py-3"
            >
              {error}
            </motion.div>
          )}

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-center py-3 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="text-sm text-[var(--color-accent-secondary)] hover:text-white transition-colors"
          >
            {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-[var(--color-glass-border)]">
          <p className="text-xs text-[#4a4a60] text-center font-mono">
            Default: admin@schedulord.local / ChangeMe123!
          </p>
        </div>
      </motion.div>
    </div>
  )
}
