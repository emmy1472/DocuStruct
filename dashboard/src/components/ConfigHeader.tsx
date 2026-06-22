import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import type { ApiConfig } from '../services/api'

interface ConfigHeaderProps {
  config: ApiConfig
  onChange: (config: ApiConfig) => void
  isLive: boolean
  checking: boolean
}

export default function ConfigHeader({ config, onChange, isLive, checking }: ConfigHeaderProps) {
  return (
    <section className="glass-card border-border p-6 shadow-lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">DocuStruct API Tester</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Production AI Pipeline Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Use this console to validate document ingestion and agentic RAG query workflows against your deployed DocuStruct backend.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-surface-700 px-4 py-3 inline-flex items-center gap-3">
          {checking ? (
            <span className="inline-flex items-center gap-2 text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking endpoint...
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
              {isLive ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-rose-400" />}
              {isLive ? 'Server reachable' : 'Server offline'}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Base URL
          <input
            className="input-base"
            value={config.baseUrl}
            onChange={(event) => onChange({ ...config, baseUrl: event.target.value })}
            placeholder="https://docustruct-f4vg.onrender.com/"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          X-API-Key
          <input
            type="password"
            className="input-base"
            value={config.apiKey}
            onChange={(event) => onChange({ ...config, apiKey: event.target.value })}
            placeholder="Optional API key for secure requests"
          />
        </label>
      </div>
    </section>
  )
}
