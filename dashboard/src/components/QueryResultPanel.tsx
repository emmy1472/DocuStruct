import { useMemo } from 'react'
import { LayoutList, Terminal, BookOpen } from 'lucide-react'

interface CitationItem {
  source: string
  page?: number
  section?: string
}

interface QueryResultPanelProps {
  answer: string
  reasoning: string
  citations: CitationItem[]
  activeTab: 'reasoning' | 'citations'
  onTabChange: (tab: 'reasoning' | 'citations') => void
}

export default function QueryResultPanel({ answer, reasoning, citations, activeTab, onTabChange }: QueryResultPanelProps) {
  const citationCount = useMemo(() => citations.length, [citations])

  return (
    <div className="glass-card border-border p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Agent Query Output</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Live reasoning stream</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-400">
          <span className="rounded-full bg-surface-700 px-3 py-1">{citationCount} citations</span>
          <span className="rounded-full bg-surface-700 px-3 py-1">Streaming SSE ready</span>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-border bg-surface-900 p-4 min-h-[220px] text-slate-100 font-mono text-sm leading-7">
        <div className="flex items-center gap-2 text-brand-300 mb-2">
          <Terminal className="h-4 w-4" />
          <span>Agent reasoning</span>
        </div>
        <div className="whitespace-pre-wrap break-words text-slate-100">{answer || 'Awaiting query results...'}<span className={answer ? 'typing-cursor' : ''} /></div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-surface-800 p-3">
        <div className="flex gap-3 border-b border-border pb-3">
          <button
            type="button"
            className={activeTab === 'reasoning' ? 'tab-active' : 'tab-inactive'}
            onClick={() => onTabChange('reasoning')}
          >
            <LayoutList className="h-4 w-4" /> Reasoning Path
          </button>
          <button
            type="button"
            className={activeTab === 'citations' ? 'tab-active' : 'tab-inactive'}
            onClick={() => onTabChange('citations')}
          >
            <BookOpen className="h-4 w-4" /> Citations
          </button>
        </div>

        {activeTab === 'reasoning' ? (
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            {reasoning ? (
              <p>{reasoning}</p>
            ) : (
              <p className="text-slate-500">No reasoning details available yet.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {citations.length ? (
              citations.map((citation, index) => (
                <div key={index} className="rounded-2xl border border-border p-3 bg-surface-700">
                  <div className="flex items-center justify-between gap-2 text-sm text-slate-200">
                    <span>{citation.source}</span>
                    <span className="text-slate-400">Page {citation.page ?? 'N/A'}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{citation.section ?? 'Exact document reference available.'}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-500">No citations captured yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
