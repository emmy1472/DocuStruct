import { useState } from 'react'

interface JsonPanelProps {
  label: string
  json: unknown
  defaultCollapsed?: boolean
}

export default function JsonPanel({ label, json, defaultCollapsed = false }: JsonPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className="glass-card border-border p-4">
      <button
        type="button"
        className="btn-ghost w-full justify-between"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <span>{label}</span>
        <span>{collapsed ? 'Expand JSON' : 'Collapse JSON'}</span>
      </button>

      {!collapsed && (
        <pre className="json-viewer mt-4">{JSON.stringify(json, null, 2)}</pre>
      )}
    </div>
  )
}
