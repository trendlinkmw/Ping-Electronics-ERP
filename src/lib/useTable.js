import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Small helper for list + insert + update against a single Supabase table.
 * Not meant to replace real data-layer patterns (react-query etc) — kept
 * dependency-free so the prototype has no extra moving parts to install.
 */
export function useTable(table, { select = '*', orderBy = 'created_at', ascending = false } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.from(table).select(select).order(orderBy, { ascending })
    if (error) setError(error.message)
    else setRows(data || [])
    setLoading(false)
  }, [table, select, orderBy, ascending])

  useEffect(() => { refresh() }, [refresh])

  const insert = async (payload) => {
    const { data, error } = await supabase.from(table).insert(payload).select()
    if (error) throw error
    await refresh()
    return data
  }

  const update = async (id, payload) => {
    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select()
    if (error) throw error
    await refresh()
    return data
  }

  const remove = async (id) => {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
    await refresh()
  }

  return { rows, loading, error, refresh, insert, update, remove }
}
