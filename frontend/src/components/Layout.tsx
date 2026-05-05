import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../store/store'
import { logout } from '../store/authSlice'
import { disconnectSocket } from '../socket'
import { motion, AnimatePresence } from 'framer-motion'

const adminNavItems = [
  { to: '/panel/dashboard', label: 'Command Center', icon: '◈' },
  { to: '/panel/admin-request-decisions', label: 'Request Decisions', icon: '◉' },
  { to: '/panel/admin-resources', label: 'Resource Control', icon: '▣' },
  { to: '/panel/decisions', label: 'Decision Intel', icon: '◆' },
  { to: '/panel/analytics', label: 'Analytics', icon: '◎' },
  { to: '/panel/admin-manage', label: 'Admin Management', icon: '✦' },
]

const clientNavItems = [
  { to: '/panel/requests', label: 'My Requests', icon: '◉' },
  { to: '/panel/dashboard', label: 'My Dashboard', icon: '◈' },
  { to: '/panel/resources', label: 'Available Resources', icon: '▣' },
]

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true)
  const [theme, setTheme] = useState('dark')
  
  const user = useSelector((s: RootState) => s.auth.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleLogout = () => {
    disconnectSocket()
    dispatch(logout())
    navigate('/')
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setIsSidebarOpen(false)
      else setIsSidebarOpen(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const navItems = user?.role === 'admin' ? adminNavItems : clientNavItems;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0, x: -50 }}
            animate={{ width: 260, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -50 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute md:relative z-[60] h-full flex-shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden shadow-2xl md:shadow-none"
          >
            <div className="w-[260px] h-full flex flex-col">
              {/* Logo */}
              <div className="px-6 py-8 border-b border-[var(--border-color)] flex justify-center items-center">
                <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-[0.2em] uppercase text-center">SCHEDULORD</h1>
              </div>

              {/* Nav */}
              <nav className="flex-1 py-4 px-3 space-y-2 overflow-y-auto">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => { if (window.innerWidth <= 768) setIsSidebarOpen(false) }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded text-xs font-bold uppercase tracking-widest transition-all ${
                        isActive ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-l-2 border-[#D4AF37]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] border-l-2 border-transparent'
                      }`
                    }
                  >
                    <span className="text-[8px] opacity-50">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              {/* User */}
              <div className="px-4 py-4 border-t border-[var(--border-color)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded bg-[#D4AF37] flex items-center justify-center text-black font-black text-sm">
                    {(user?.name || user?.email || 'O')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{user?.name || 'Operative'}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">{user?.role || 'user'}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:bg-[#D4AF37] hover:text-black hover:border-[#D4AF37] text-[var(--text-secondary)] text-[10px] uppercase tracking-widest font-bold rounded transition-colors">
                  Sign Out
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Controls */}
        <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center pointer-events-none">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="pointer-events-auto p-2.5 bg-black/40 backdrop-blur-md border border-[var(--border-color)] rounded-full text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.5)] group"
            title="Toggle Sidebar"
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <button
            onClick={toggleTheme}
            className="pointer-events-auto p-2.5 bg-black/40 backdrop-blur-md border border-[var(--border-color)] rounded-full text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.5)] group"
            title="Toggle Theme"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 transition-transform group-hover:scale-110 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-6 pt-24 sm:pt-20 bg-[var(--bg-primary)] transition-colors duration-300">
          <div className="relative z-10 h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
