import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../store/store'
import { logout } from '../store/authSlice'
import { disconnectSocket } from '../socket'
import { motion } from 'framer-motion'

const adminNavItems = [
  { to: '/panel/dashboard', label: 'Command Center', icon: '◆' },
  { to: '/panel/resources', label: 'Global Resources', icon: '▣' },
  { to: '/panel/requests', label: 'All Requests', icon: '↗' },
  { to: '/panel/decisions', label: 'Decision Intel', icon: '◎' },
  { to: '/panel/analytics', label: 'Analytics', icon: '◈' },
]

const clientNavItems = [
  { to: '/panel/dashboard', label: 'My Dashboard', icon: '◆' },
  { to: '/panel/requests', label: 'My Requests', icon: '↗' },
]

export default function Layout() {
  const user = useSelector((s: RootState) => s.auth.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleLogout = () => {
    disconnectSocket()
    dispatch(logout())
    navigate('/')
  }

  const navItems = user?.role === 'admin' ? adminNavItems : clientNavItems;

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
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-black text-sm shadow-[0_0_10px_rgba(234,179,8,0.3)]">
              {(user?.name || user?.email || '?')[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user?.name || 'Operative'}</p>
              <p className="text-[10px] text-[#636380] uppercase tracking-widest">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-xs uppercase tracking-widest font-bold rounded transition-colors">
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
