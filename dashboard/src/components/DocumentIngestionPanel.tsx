import { useCallback, useMemo } from 'react'
import { CloudUpload, FileText } from 'lucide-react'
import JsonPanel from './JsonPanel'
import type { ApiConfig } from '../services/api'

interface DocumentIngestionPanelProps {
  config: ApiConfig
  uploadState: 'idle' | 'uploading' | 'queued' | 'processing' | 'validating' | 'complete' | 'error'
  progress: number
  responseJson: unknown
  fileName: string
  errorMessage: string
  onSelectFile: (file: File) => void
}

const mockWorkflow = ['Queued', 'Processing (Extracting Layout)', 'Validating Schema', 'Complete']

export default function DocumentIngestionPanel({
  config,
  uploadState,
  progress,
  responseJson,
  fileName,
  errorMessage,
  onSelectFile,
}: DocumentIngestionPanelProps) {
  const statusLabel = useMemo(() => {
    switch (uploadState) {
      case 'uploading':
        return 'Uploading file...'
      case 'queued':
        return 'In queue for processing'
      case 'processing':
        return 'Extracting layout and text'
      case 'validating':
        return 'Validating document schema'
      case 'complete':
        return 'Upload complete'
      case 'error':
        return 'Upload failed'
      default:
        return 'Ready to ingest a document'
    }
  }, [uploadState])

  const statusStep = useMemo(() => {
    const index = mockWorkflow.findIndex((step) =>
      statusLabel.toLowerCase().includes(step.toLowerCase()),
    )
    return Math.max(0, index)
  }, [statusLabel])

  const openFilePicker = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.md,.markdown,.txt'
    input.onchange = () => {
      if (input.files?.[0]) onSelectFile(input.files[0])
    }
    input.click()
  }, [onSelectFile])

  return (
    <section className="glass-card border-border p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Document Ingestion</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Upload PDF, Markdown or TXT</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-3xl bg-surface-700 px-4 py-2 text-sm text-slate-300">
          <FileText className="h-4 w-4" /> Accepted: PDF / MD / TXT
        </div>
      </div>

      <div
        className={`mt-6 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 ${
          uploadState === 'uploading' ? 'border-brand-500 bg-surface-800' : 'border-border bg-surface-700 hover:border-brand-500 hover:bg-surface-800'
        }`}
        onClick={openFilePicker}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files?.[0]
          if (file) onSelectFile(file)
        }}
      >
        <CloudUpload className="mx-auto h-10 w-10 text-brand-500" />
        <p className="mt-4 text-lg font-semibold text-white">Drag & drop a file here</p>
        <p className="mt-2 text-sm text-slate-400">or click to browse your local machine</p>
        <p className="mt-4 text-xs text-slate-500">Supported formats: PDF, Markdown, TXT</p>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="rounded-3xl border border-border bg-surface-900 p-4">
          <div className="flex items-center justify-between gap-2 text-sm text-slate-400">
            <span>Status</span>
            <span className="font-semibold text-slate-100">{statusLabel}</span>
          </div>

          <div className="mt-4 grid gap-3">
            {mockWorkflow.map((step, index) => (
              <div key={step} className="flex items-center gap-3 text-sm">
                <span className={`inline-flex h-3 w-3 rounded-full ${index <= statusStep ? 'bg-brand-500' : 'bg-slate-700'}`} />
                <span className={index <= statusStep ? 'text-slate-100' : 'text-slate-500'}>{step}</span>
              </div>
            ))}
          </div>

          {uploadState === 'uploading' && (
            <div className="mt-4 rounded-2xl bg-surface-800 p-3">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                <span>Upload Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-3xl border border-rose-500 bg-rose-950/20 p-4 text-sm text-rose-200">
            <strong className="text-rose-100">Upload error:</strong> {errorMessage}
          </div>
        )}

        <JsonPanel
          label={responseJson ? `Server Response for ${fileName || 'document'}` : 'Server Response'}
          json={responseJson || { message: 'Upload response will appear here.' }}
          defaultCollapsed={!responseJson}
        />
      </div>
    </section>
  )
}
