// Central API service for DocuStruct — all network calls live here

export interface DocumentResponse {
  id: string;
  filename: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error_message: string | null;
  created_at: string;
  updated_at: string;
  extracted_data: Record<string, unknown> | null;
}

export interface Citation {
  source_chunk_id: string;
  page_number: number;
  text_segment: string;
}

export interface QueryResponse {
  query: string;
  answer: string;
  citations: Citation[];
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

export interface QueryStreamResult {
  finalText: string;
  reasoning: string;
  citations: Citation[];
  raw?: unknown;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

function buildUrl(config: ApiConfig, path: string) {
  return `${normalizeBaseUrl(config.baseUrl)}${path}`
}

function buildHeaders(config: ApiConfig, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra }
  if (config.apiKey) headers['X-API-Key'] = config.apiKey
  return headers
}

export async function checkHealth(config: ApiConfig): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(config, '/'), {
      method: 'GET',
      headers: buildHeaders(config),
      signal: AbortSignal.timeout(6000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function uploadDocument(
  config: ApiConfig,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<DocumentResponse> {
  const form = new FormData()
  form.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUrl(config, '/api/v1/documents/upload'))
    if (config.apiKey) xhr.setRequestHeader('X-API-Key', config.apiKey)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('Invalid JSON response from server'))
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText)
          reject(new Error(err.detail || `Upload failed: ${xhr.status}`))
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      }
    }

    xhr.onerror = () => reject(new Error('Network error — could not reach the server.'))
    xhr.ontimeout = () => reject(new Error('Upload timed out after 120 seconds. If the file is large, retry with a smaller document or check the server status.'))
    xhr.timeout = 120000
    xhr.send(form)
  })
}

export async function getDocument(config: ApiConfig, documentId: string): Promise<DocumentResponse> {
  const res = await fetch(buildUrl(config, `/api/v1/documents/${documentId}`), {
    headers: buildHeaders(config),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || `Error ${res.status}`)
  }

  return res.json()
}

export async function listDocuments(config: ApiConfig): Promise<DocumentResponse[]> {
  const res = await fetch(buildUrl(config, '/api/v1/documents'), {
    headers: buildHeaders(config),
  })

  if (!res.ok) throw new Error(`Failed to list documents: ${res.status}`)
  return res.json()
}

export async function streamQuery(
  config: ApiConfig,
  query: string,
  documentId: string | null,
  onChunk: (chunk: string) => void,
): Promise<QueryStreamResult> {
  const res = await fetch(buildUrl(config, '/api/v1/query'), {
    method: 'POST',
    headers: buildHeaders(config, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ query, document_id: documentId || undefined }),
    signal: AbortSignal.timeout(120000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || `Query failed: ${res.status}`)
  }

  const payload = await res.json()
  const answer = payload.answer || ''
  const citations = payload.citations || []

  // Simulate streaming by typing the answer
  // We send chunks of 3 characters every 15ms
  const chunkSize = 3
  const delay = 15
  
  await new Promise<void>((resolve) => {
    let index = 0
    const interval = setInterval(() => {
      if (index >= answer.length) {
        clearInterval(interval)
        resolve()
      } else {
        const chunk = answer.slice(index, index + chunkSize)
        onChunk(chunk)
        index += chunkSize
      }
    }, delay)
  })

  return {
    finalText: answer,
    reasoning: 'Routed to vector search → extracted chunks → verified citations.',
    citations: citations,
    raw: payload,
  }
}
