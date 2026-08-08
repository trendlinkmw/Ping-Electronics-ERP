import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function Login() {
  const { session, bannedMessage, clearBannedMessage } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    clearBannedMessage()
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        })
        if (error) throw error
        setNotice('Account created. If email confirmation is on in Supabase, check your inbox before signing in.')
        setMode('signin')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center flex flex-col items-center">
          <img src={logo} alt="Ping Electronics" className="w-16 h-16 object-contain mb-3" />
          <div className="text-surge font-mono text-xs tracking-widest mb-1">TRENDLINK ERP</div>
          <div className="text-2xl font-semibold text-slate-100">Ping Electronics</div>
        </div>

        {bannedMessage && (
          <div className="bg-bad/10 border border-bad/40 text-bad text-sm rounded-lg px-4 py-3 mb-4">
            {bannedMessage}
          </div>
        )}

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div className="flex text-sm border border-line rounded-lg overflow-hidden mb-2">
            <button type="button" onClick={() => setMode('signin')}
              className={`flex-1 py-2 ${mode === 'signin' ? 'bg-surge/10 text-surge' : 'text-slate-400'}`}>
              Sign in
            </button>
            <button type="button" onClick={() => setMode('signup')}
              className={`flex-1 py-2 ${mode === 'signup' ? 'bg-surge/10 text-surge' : 'text-slate-400'}`}>
              Create account
            </button>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && <div className="text-bad text-sm">{error}</div>}
          {notice && <div className="text-good text-sm">{notice}</div>}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="text-xs text-slate-500 mt-4 text-center">
            New accounts have no role until an administrator assigns one via User Management. The very first
            account should be granted the administrator role manually in Supabase.
          </p>
        )}
      </div>
    </div>
  )
}