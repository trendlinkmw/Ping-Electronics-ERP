import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-7xl">{children}</main>
    </div>
  )
}
