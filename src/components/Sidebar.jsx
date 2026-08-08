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
  { to: '/users', label: 'User Management', icon: '⚙', roles: [] },
  { to: '/settings', label: 'Settings', icon: '⛭', roles: [] },
]

export default function Sidebar() {
  const { profile, roles, hasRole, signOut } = useAuth()

  const visible = NAV.filter(item => !item.roles || hasRole(...item.roles, 'administrator'))

  return (
    <aside className="w-60 shrink-0 bg-panel border-r border-line flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-line flex items-center gap-3">
        <img src={logo} alt="Ping Electronics" className="w-10 h-10 object-contain" />
        <div>
          <div className="text-surge font-mono text-[10px] tracking-widest">TRENDLINK</div>
          <div className="text-slate-100 font-semibold text-sm leading-tight">Ping Electronics</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {visible.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
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
        <div className="text-sm text-slate-100 font-medium truncate">{profile?.full_name || 'User'}</div>
        <div className="text-xs text-slate-500 truncate mb-3">{roles.join(', ') || 'no role assigned'}</div>
        <button onClick={signOut} className="btn-ghost w-full text-sm">Sign out</button>
      </div>
    </aside>
  )
}