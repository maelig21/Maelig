"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Pencil } from "lucide-react"
import { formatEUR } from "@/lib/utils"
import { updateArticlePrice } from "@/lib/actions/articles"

export function EditablePriceCell({
  id,
  value,
  canEdit,
}: {
  id: string
  value: number
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(String(value))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const save = useCallback(async () => {
    const num = parseFloat(price.replace(",", "."))
    if (isNaN(num) || num < 0) {
      setError("Prix invalide")
      return
    }
    if (num === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError("")
    try {
      await updateArticlePrice(id, num)
      setPrice(String(num))
      setEditing(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }, [id, price, value])

  if (!canEdit || !editing) {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono cursor-pointer hover:text-electric transition-colors"
        onClick={() => canEdit && setEditing(true)}
        title={canEdit ? "Cliquer pour modifier le prix" : undefined}
      >
        {formatEUR(value)}
        {canEdit && <Pencil className="h-3 w-3 text-muted" />}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={price}
        onChange={(e) => { setPrice(e.target.value); setError("") }}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setPrice(String(value)) } }}
        disabled={saving}
        className="w-24 px-1.5 py-0.5 text-right font-mono text-sm border border-border rounded bg-surface-2 focus:outline-none focus:border-electric"
      />
      {saving && <span className="text-xs text-muted">…</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  )
}
