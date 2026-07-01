import { AlertTriangle, Check, Layers, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PromptEditor } from '@/components/shared/PromptEditor'
import { useAISettings } from '@/hooks/useAISettings'
import { usePromptSlots } from '@/hooks/usePromptSlots'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { missingPromptVars, REQUIRED_PROMPT_VARS } from '@/types'
import { SettingsSectionCard } from './SettingsSectionCard'

function VarChecklist({ prompt }: { prompt: string }): React.JSX.Element {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {REQUIRED_PROMPT_VARS.map((v) => {
        const present = prompt.includes(`{${v}}`)
        return (
          <span
            key={v}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] ${
              present
                ? 'bg-amber-500/12 text-amber-400'
                : 'border border-red-500/40 bg-red-500/10 text-red-400'
            }`}
          >
            {present ? <Check size={11} /> : <AlertTriangle size={11} />}
            {`{${v}}`}
          </span>
        )
      })}
    </div>
  )
}

function PromptTip(): React.JSX.Element {
  const { t } = useAppTranslation(['ai'])
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex h-4.5 w-4.5 cursor-help items-center justify-center rounded-full border border-neutral-600 font-mono text-[11px] font-bold text-neutral-400">
        ?
      </span>
      <span className="pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-50 w-80 -translate-x-1/2 rounded-lg border border-neutral-700 bg-neutral-900 px-3.5 py-3 text-xs leading-relaxed text-neutral-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
        {t('slots.tooltip.text')}
        <span className="mt-2 block rounded-md border border-neutral-800 bg-[#0a0a0c] px-2.5 py-2 font-mono whitespace-pre-wrap text-neutral-400">
          {t('slots.tooltip.example')}
        </span>
      </span>
    </span>
  )
}

export function PromptSlotsCard(): React.JSX.Element {
  const { t } = useAppTranslation(['ai', 'common', 'toasts'])
  const { slots, create, update, remove } = usePromptSlots()
  const { activePromptSlotId, set } = useAISettings()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  const [nameVal, setNameVal] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const defaultSlot = slots.find((s) => s.isDefault)

  useEffect(() => {
    if (naming) nameInputRef.current?.focus()
  }, [naming])

  // Initialise selection once slots have loaded.
  useEffect(() => {
    if (slots.length === 0 || selectedId !== null) return
    const preferred =
      activePromptSlotId && slots.some((s) => s.id === activePromptSlotId)
        ? activePromptSlotId
        : (defaultSlot?.id ?? slots[0].id)
    setSelectedId(preferred)
    setDraft(slots.find((s) => s.id === preferred)?.prompt ?? '')
  }, [slots, selectedId, activePromptSlotId, defaultSlot])

  const current = slots.find((s) => s.id === selectedId) ?? null
  const isLocked = current?.isDefault ?? false
  const missing = missingPromptVars(draft)

  const selectSlot = (id: number, prompt: string): void => {
    setSelectedId(id)
    setDraft(prompt)
    setDirty(false)
    setError(null)
    void set('ai_active_prompt_slot', String(id))
  }

  const pickSlot = (id: number): void => {
    const slot = slots.find((s) => s.id === id)
    if (slot) selectSlot(id, slot.prompt)
  }

  const forkDefault = async (): Promise<void> => {
    try {
      const slot = await create(t('slots.copyName'), draft)
      selectSlot(slot.id, slot.prompt)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const confirmName = async (): Promise<void> => {
    const seed = defaultSlot?.prompt ?? draft
    try {
      const slot = await create(nameVal.trim() || t('slots.newSlotName'), seed)
      selectSlot(slot.id, slot.prompt)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    } finally {
      setNaming(false)
      setNameVal('')
    }
  }

  const saveSlot = async (): Promise<void> => {
    if (selectedId === null) return
    if (missing.length > 0) {
      setError(t('slots.missingVarsError', { vars: missing.map((v) => `{${v}}`).join(', ') }))
      return
    }
    try {
      await update(selectedId, { prompt: draft })
      setDirty(false)
      setError(null)
      toast.success(t('ai.promptSaved', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const deleteSlot = async (): Promise<void> => {
    if (selectedId === null) return
    try {
      await remove(selectedId)
      if (defaultSlot) selectSlot(defaultSlot.id, defaultSlot.prompt)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const onDraft = (value: string): void => {
    setDraft(value)
    setDirty(true)
    if (error) setError(null)
  }

  return (
    <SettingsSectionCard
      title={t('slots.title')}
      subtitle={t('slots.subtitle')}
      icon={<Layers size={16} />}
    >
      {/* slot bar */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => pickSlot(slot.id)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
              selectedId === slot.id
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                : 'border-neutral-800 bg-[#0a0a0c] text-neutral-300 hover:border-neutral-700'
            }`}
          >
            <span className="font-mono text-[10px] text-neutral-500">
              {`P${String(slot.id).padStart(2, '0')}`}
            </span>
            {slot.name}
            {slot.isDefault && <Lock size={11} />}
          </button>
        ))}
        {naming ? (
          <input
            ref={nameInputRef}
            value={nameVal}
            placeholder={t('slots.namePlaceholder')}
            onChange={(e) => setNameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void confirmName()
              if (e.key === 'Escape') {
                setNaming(false)
                setNameVal('')
              }
            }}
            onBlur={() => void confirmName()}
            className="w-44 rounded-md border border-amber-500 bg-[#0a0a0c] px-2.5 py-1.5 text-sm text-neutral-200 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-400 transition-colors hover:border-amber-500 hover:text-amber-400"
          >
            <Plus size={13} /> {t('slots.newSlot')}
          </button>
        )}
      </div>

      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
        {isLocked ? t('slots.defaultReadOnly') : t('slots.editing', { name: current?.name ?? '' })}
        <PromptTip />
      </div>

      <PromptEditor value={draft} onChange={onDraft} readOnly={isLocked} error={!!error} />

      <VarChecklist prompt={draft} />

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <strong>{t('slots.cannotSave')}</strong> {error}
          </div>
        </div>
      )}

      {isLocked && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-neutral-300">
          <Lock size={14} className="mt-0.5 shrink-0 text-amber-400" />
          <div>{t('slots.lockedNotice')}</div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2.5">
        {isLocked ? (
          <button
            type="button"
            onClick={() => void forkDefault()}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/90 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-500"
          >
            <Pencil size={13} /> {t('slots.editCreateCopy')}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void saveSlot()}
              disabled={!dirty}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/90 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={13} /> {t('slots.save')}
            </button>
            <button
              type="button"
              onClick={() => void deleteSlot()}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              <Trash2 size={13} /> {t('slots.delete')}
            </button>
          </>
        )}
        <span className="ml-auto text-xs">
          {missing.length === 0 ? (
            <span className="text-amber-400">{t('slots.allVarsPresent')}</span>
          ) : (
            <span className="text-neutral-500">
              {t('slots.missingCount', { count: missing.length })}
            </span>
          )}
        </span>
      </div>
    </SettingsSectionCard>
  )
}
