import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCcw, Send } from 'lucide-react'
import ConfigHeader from './components/ConfigHeader'
import DocumentIngestionPanel from './components/DocumentIngestionPanel'
import QueryResultPanel from './components/QueryResultPanel'
import JsonPanel from './components/JsonPanel'
import type { ApiConfig } from './services/api'
import { checkHealth, getDocument, streamQuery, uploadDocument } from './services/api'

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: 'https://docustruct-f4vg.onrender.com',
  apiKey: '',
}

interface CitationItem {
  source: string
  page?: number
  section?: string
}

function App() {
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG)
  const [isLive, setIsLive] = useState(false)
  const [checking, setChecking] = useState(true)

  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'queued' | 'processing' | 'validating' | 'complete' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [documentResponse, setDocumentResponse] = useState<unknown>(null)
  const [currentFileName, setCurrentFileName] = useState('')
  const [uploadError, setUploadError] = useState('')

  const [queryText, setQueryText] = useState('')
  const [queryAnswer, setQueryAnswer] = useState('')
  const [reasoningPath, setReasoningPath] = useState('')
  const [citations, setCitations] = useState<CitationItem[]>([])
  const [queryRawResponse, setQueryRawResponse] = useState<unknown>(null)
  const [queryError, setQueryError] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [activeQueryTab, setActiveQueryTab] = useState<'reasoning' | 'citations'>('reasoning')

  useEffect(() => {
    let active = true
    const checkServer = async () => {
      setChecking(true)
      const healthy = await checkHealth(config)
      if (!active) return
      setIsLive(healthy)
      setChecking(false)
    }

    checkServer()
    const interval = window.setInterval(checkServer, 15000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [config.baseUrl, config.apiKey])

  const syncUploadState = async (documentId: string) => {
    try {
      const document = await getDocument(config, documentId)
      setDocumentResponse(document)
      const status = (document as { status?: string }).status

      if (status === 'COMPLETED') {
        setUploadState('complete')
        return
      }

      if (status === 'FAILED') {
        setUploadState('error')
        setUploadError((document as { error_message?: string }).error_message || 'Document ingestion failed.')
        return
      }

      if (status === 'PROCESSING') {
        setUploadState('processing')
      } else {
        setUploadState('queued')
      }

      window.setTimeout(() => syncUploadState(documentId), 3000)
    } catch (error) {
      setUploadState('error')
      setUploadError((error as Error).message || 'Unable to retrieve document status.')
    }
  }

  const handleFileUpload = async (file: File) => {
    setUploadError('')
    setUploadState('uploading')
    setUploadProgress(0)
    setCurrentFileName(file.name)
    setDocumentResponse(null)

    try {
      const response = await uploadDocument(config, file, (pct) => setUploadProgress(pct))
      setDocumentResponse(response)
      if ((response as { id?: string }).id) {
        setUploadState('queued')
        syncUploadState((response as { id: string }).id)
      } else {
        setUploadState('complete')
      }
    } catch (error) {
      setUploadState('error')
      setUploadError((error as Error).message || 'Upload failed unexpectedly.')
    }
  }

  const handleQuerySubmit = async () => {
    setQueryError('')
    if (!queryText.trim()) {
      setQueryError('Please enter a question before submitting.')
      return
    }

    setStreaming(true)
    setQueryAnswer('')
    setReasoningPath('')
    setCitations([])
    setQueryRawResponse(null)

    try {
      const result = await streamQuery(config, queryText, (chunk) => {
        setQueryAnswer((current) => current + chunk)
      })

      setReasoningPath(result.reasoning || 'Routed to vector search → extracted chunks → verified citations.')
      setCitations(
        result.citations?.map((citation) => ({
          source: citation.source_chunk_id || citation.source_chunk_id || 'Unknown source',
          page: citation.page_number,
          section: citation.text_segment,
        })) || [],
      )
      setQueryRawResponse(result)
    } catch (error) {
      setQueryError((error as Error).message || 'Query failed during streaming.')
    } finally {
      setStreaming(false)
    }
  }

  const missingApiKey = !config.apiKey.trim()

  return (
    <div className="min-h-screen bg-surface-900 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <ConfigHeader config={config} onChange={setConfig} isLive={isLive} checking={checking} />

        {missingApiKey && (
          <div className="glass-card border-rose-500/40 border bg-rose-950/20 px-5 py-4 text-sm text-rose-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-300" />
              <span>X-API-Key is empty. Requests may be rejected by your backend if it requires authentication.</span>
            </div>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <DocumentIngestionPanel
            uploadState={uploadState}
            progress={uploadProgress}
            responseJson={documentResponse}
            fileName={currentFileName}
            errorMessage={uploadError}
            onSelectFile={handleFileUpload}
          />

          <section className="glass-card border-border p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Agentic RAG Query</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Ask your documents anything</h2>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setQueryText('')}
              >
                <RefreshCcw className="h-4 w-4" /> Reset
              </button>
            </div>

            <label className="mt-6 block text-sm text-slate-300">
              Query prompt
              <textarea
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                rows={6}
                placeholder="What are the safety clearance metrics defined in Section 4?"
                className="input-base mt-2 min-h-[180px] resize-none"
              />
            </label>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">The query endpoint streams results back using SSE for low-latency reasoning.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={handleQuerySubmit}
                disabled={streaming}
              >
                <Send className="h-4 w-4" />
                {streaming ? 'Streaming...' : 'Run Query'}
              </button>
            </div>

            {queryError && (
              <div className="mt-4 rounded-3xl border border-rose-500 bg-rose-950/20 p-4 text-sm text-rose-200">
                <strong className="text-rose-100">Query error:</strong> {queryError}
              </div>
            )}

            <div className="mt-6 grid gap-6">
              <QueryResultPanel
                answer={queryAnswer}
                reasoning={reasoningPath}
                citations={citations}
                activeTab={activeQueryTab}
                onTabChange={setActiveQueryTab}
              />

              <JsonPanel
                label="Query response metadata"
                json={queryRawResponse || { message: 'Streaming metadata and citations will appear here.' }}
                defaultCollapsed={!queryRawResponse}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
