import { Check, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { useAISettings } from '@/hooks/useAISettings'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { AiProviderId, ConfigKey } from '@/types'
import { AI_PROVIDERS, type AiProviderMeta, getProviderMeta } from './aiProviders'
import { SettingsSectionCard } from './SettingsSectionCard'

interface ProviderRowProps {
  meta: AiProviderMeta
  active: boolean
  keyValue: string
  model: string
  onSelect: () => void
  onSaveKey: (key: ConfigKey, value: string) => Promise<void>
  onSaveModel: (value: string) => void
}

function ProviderRow({
  meta,
  active,
  keyValue,
  model,
  onSelect,
  onSaveKey,
  onSaveModel
}: ProviderRowProps): React.JSX.Element {
  const { t } = useAppTranslation(['ai', 'common', 'toasts'])
  const [draft, setDraft] = useState(keyValue)
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)
  const connected = draft.trim().length > 6

  const handleSave = async (): Promise<void> => {
    await onSaveKey(meta.keyConfigKey, draft.trim())
    setSaved(true)
    toast.success(t('settings.saved', { ns: 'toasts', label: `${meta.name} API key` }))
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors ${
        active ? 'border-amber-500/60 bg-amber-500/5' : 'border-neutral-800 bg-[#0a0a0c]'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSelect}
          title={t('providers.useThis')}
          className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            active ? 'border-amber-500' : 'border-neutral-600'
          }`}
        >
          {active && <span className="h-2 w-2 rounded-full bg-amber-500" />}
        </button>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold text-white"
          style={{ background: meta.color }}
        >
          {meta.mark}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-neutral-200">{meta.name}</div>
          <div className={`text-[10px] ${connected ? 'text-amber-400' : 'text-neutral-500'}`}>
            {connected ? t('providers.connected') : t('providers.noKey')}
          </div>
        </div>
        <div className="w-40 shrink-0">
          <ThemedSelect
            value={model}
            onChange={onSaveModel}
            options={meta.models.map((m) => ({ value: m, label: m }))}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-1 rounded-md border border-neutral-800 bg-[#0a0a0c] px-3 focus-within:border-amber-500">
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            placeholder={meta.keyPlaceholder}
            onChange={(e) => {
              setDraft(e.target.value)
              setSaved(false)
            }}
            className="flex-1 bg-transparent py-2 font-mono text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-neutral-500 hover:text-neutral-300"
            title={show ? t('providers.hideKey') : t('providers.showKey')}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md border border-neutral-700/50 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
        >
          {saved ? t('providers.saved') : t('providers.save')}
        </button>
      </div>
    </div>
  )
}

export function AiProvidersCard(): React.JSX.Element {
  const { t } = useAppTranslation(['ai'])
  const { set, provider, modelFor, keyFor } = useAISettings()

  const selectProvider = (id: AiProviderId): void => {
    void set('ai_provider', id)
  }

  return (
    <SettingsSectionCard
      title={t('providers.title')}
      subtitle={t('providers.subtitle')}
      icon={<Sparkles size={16} />}
    >
      <div className="flex flex-col gap-2">
        {AI_PROVIDERS.map((meta) => (
          <ProviderRow
            key={meta.id}
            meta={meta}
            active={provider === meta.id}
            keyValue={keyFor(meta.id)}
            model={modelFor(meta.id)}
            onSelect={() => selectProvider(meta.id)}
            onSaveKey={set}
            onSaveModel={(value) => void set(meta.modelConfigKey, value)}
          />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
        <Check size={12} className="text-amber-500" />
        {t('providers.activeHint', {
          provider: getProviderMeta(provider).name,
          model: modelFor(provider)
        })}
      </p>
    </SettingsSectionCard>
  )
}
