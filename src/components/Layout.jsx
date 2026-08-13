import { useState } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-panel border-b border-line">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-200 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="text-slate-100 font-semibold">Ping Electronics</span>
        </div>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full">{children}</main>
      </div>
    </div>
  )
}