import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◆', roles: ['manager', 'accountant', 'ceo'] },
  { to: '/sales', label: 'Sales / POS', icon: '⬡', roles: ['salesperson', 'cashier', 'manager'] },
  { to: '/history', label: 'History', icon: '⏱', roles: ['salesperson', 'cashier', 'manager', 'accountant'] },
  { to: '/products', label: 'Products', icon: '▤', roles: ['manager', 'storekeeper'] },
  { to: '/stock-adjustment', label: 'Stock Adjustment', icon: '⟲', roles: ['manager', 'storekeeper'] },
  { to: '/purchases', label: 'Purchases', icon: '▥', roles: ['manager', 'storekeeper'] },
  { to: '/customers', label: 'Customers', icon: '◈', roles: ['manager', 'salesperson'] },
  { to: '/suppliers', label: 'Suppliers', icon: '◇', roles: ['manager', 'storekeeper'] },
  { to: '/expenses', label: 'Expenses', icon: '▦', roles: ['accountant'] },
  { to: '/payments', label: 'Payments', icon: '◎', roles: ['cashier', 'accountant', 'salesperson', 'manager'] },
  { to: '/reports', label: 'Reports', icon: '▨', roles: ['manager', 'accountant', 'ceo'] },
  { to: '/users', label: 'User Management', icon: '⚙', roles: ['ceo'] },
  { to: '/settings', label: 'Settings', icon: '⛭', roles: null },
]

export default function Sidebar({ open, onClose }) {
  const { profile, roles, hasRole, signOut } = useAuth()

  const visible = NAV.filter(item => !item.roles || hasRole(...item.roles, 'administrator'))

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-panel border-r border-line flex flex-col
          transform transition-transform duration-200 ease-in-out
          lg:static lg:z-auto lg:w-60 lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="px-5 py-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Ping Electronics" className="w-10 h-10 object-contain" />
            <div>
              <div className="text-surge font-mono text-[10px] tracking-widest">TRENDLINK</div>
              <div className="text-slate-100 font-semibold text-sm leading-tight">Ping Electronics</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 text-xl leading-none w-8 h-8">✕</button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {visible.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? 'bg-surge/10 text-surge' : 'text-slate-300 hover:bg-line'
                }`
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-line">
          <NavLink
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-3 mb-3 hover:opacity-80 transition"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-line" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-ink border border-line flex items-center justify-center text-slate-500 text-sm">
                {profile?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm text-slate-100 font-medium truncate">{profile?.full_name || 'User'}</div>
              <div className="text-xs text-slate-500 truncate">{roles.join(', ') || 'no role assigned'}</div>
            </div>
          </NavLink>
          <button onClick={signOut} className="btn-ghost w-full text-sm">Sign out</button>
        </div>
      </aside>
    </>
  )
}