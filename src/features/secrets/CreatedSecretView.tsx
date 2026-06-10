import { useState } from 'react'
import { formatDateTime } from '@/lib/format.ts'

export interface CreatedSecretViewProps {
  link: string
  expiresAt: number
  maxViews: number
  onReset: () => void
}

export function CreatedSecretView({ link, expiresAt, maxViews, onReset }: CreatedSecretViewProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="card">
      <h1>Your secret link is ready</h1>
      <div className="field">
        <label htmlFor="share-link">Share this link</label>
        <div className="row">
          <input
            id="share-link"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" onClick={copy} aria-label="Copy link to clipboard">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <p className="muted">
        Self-destructs after {maxViews} view{maxViews === 1 ? '' : 's'} or on{' '}
        {formatDateTime(expiresAt)}.
      </p>
      <p className="warning">
        Anyone with this link can read the secret, and it can&apos;t be recovered once it&apos;s
        gone.
      </p>
      <button type="button" className="ghost" onClick={onReset}>
        Create another
      </button>
    </section>
  )
}
