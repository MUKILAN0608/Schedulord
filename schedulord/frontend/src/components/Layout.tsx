import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../store/store'
import { logout } from '../store/authSlice'
import { disconnectSocket } from '../socket'
import { motion } from 'framer-motion'

const navItems = [
  { to: '/', label: 'Command Center', icon: '◆' },
  { to: '/resources', label: 'Resources', icon: '▣' },
  { to: '/requests', label: 'Requests', icon: '↗' },
  { to: '/decisions', label: 'Decision Intel', icon: '◎' },
  { to: '/analytics', label: 'Analytics', icon: '◈' },
]

export default function Layout() {
  const user = useSelector((s: RootState) => s.auth.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleLogout = () => {
    disconnectSocket()
    dispatch(logout())
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-[260px] flex-shrink-0 glass-card rounded-none border-t-0 border-l-0 border-b-0 flex flex-col"
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-[var(--color-glass-border)]">
          <h1 className="text-xl font-bold gradient-text tracking-wider">SCHEDULORD</h1>
          <p className="text-xs text-[#636380] mt-1 font-mono">v1.0 • DISTRIBUTED ENGINE</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  isActive ? 'active text-white' : 'text-[#8888a0] hover:text-white'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-[var(--color-glass-border)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center text-white font-bold text-sm">
              {user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-[#636380] uppercase">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full btn-secondary text-xs py-2">
            Sign Out
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 bg-[var(--color-dark-900)]">
        <Outlet />
      </main>
    </div>
  )
}
