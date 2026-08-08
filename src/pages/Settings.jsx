import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { applyTheme } from '../lib/applyTheme'

const MODES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className="text-slate-100 text-sm">{value || '—'}</div>
    </div>
  )
}

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('system')
  const [savingMode, setSavingMode] = useState(false)

  useEffect(() => {
    supabase.from('companies').select('*').order('created_at').limit(1).single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setCompany(data || null)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (profile?.theme) setMode(profile.theme)
  }, [profile])

  const changeMode = async (value) => {
    setMode(value)
    applyTheme(value) // instant feedback, no reload needed
    setSavingMode(true)
    try {
      await supabase.from('profiles').update({ theme: value }).eq('id', profile.id)
      refreshProfile()
    } finally {
      setSavingMode(false)
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading settings…</div>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-6">
        Business details are managed directly in the database by the system administrator — this page shows
        them for reference. Appearance is personal to your account and you can change it below.
      </p>

      {error && <div className="text-bad text-sm mb-4">{error}</div>}

      <div className="space-y-6 max-w-2xl">
        <div className="card p-5 space-y-4">
          <div className="font-medium text-slate-100">Appearance</div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Mode</div>
            <div className="flex text-sm border border-line rounded-lg overflow-hidden max-w-xs">
              {MODES.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => changeMode(m.value)}
                  disabled={savingMode}
                  className={`flex-1 py-2 transition ${
                    mode === m.value ? 'bg-surge/10 text-surge' : 'text-slate-400 hover:bg-line'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              "System" follows your device's light/dark setting. This applies only to your account, not
              anyone else's.
            </p>
          </div>
        </div>

        {company && (
          <>
            <div className="card p-5 space-y-4">
              <div className="font-medium text-slate-100">Business</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Business name" value={company.name} />
                <Field label="Currency" value={company.currency} />
                <Field label="Phone" value={company.phone} />
                <Field label="Email" value={company.email} />
                <Field label="Tax rate" value={company.tax_rate != null ? `${company.tax_rate}%` : null} />
                <Field label="Business hours" value={company.business_hours} />
              </div>
              <Field label="Address" value={company.address} />
              <Field label="Receipt header" value={company.receipt_header} />
              <Field label="Receipt footer" value={company.receipt_footer} />
            </div>

            <div className="card p-5 space-y-4">
              <div className="font-medium text-slate-100">About / System owner</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Owner / admin name" value={company.owner_name} />
                <Field label="Contact phone" value={company.owner_phone} />
              </div>
              <Field label="Contact email" value={company.owner_email} />
              <Field label="About this system" value={company.about_text} />
            </div>

            <p className="text-xs text-slate-500">
              To update any business detail above, contact the system administrator — these fields are
              edited directly in the database, not through this page.
            </p>
          </>
        )}
      </div>
    </div>
  )
}