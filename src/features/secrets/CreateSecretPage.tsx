import { useState, type FormEvent } from 'react'
import { useCreateSecret } from './use-secrets.ts'
import { CreatedSecretView } from './CreatedSecretView.tsx'
import {
  DEFAULT_TTL_OPTION,
  MAX_VIEWS,
  MIN_VIEWS,
  TTL_OPTIONS,
  type TtlOption,
} from '@shared/constants.ts'

const TTL_LABELS: Record<TtlOption, string> = {
  '1h': '1 hour',
  '1d': '1 day',
  '7d': '7 days',
}

export function CreateSecretPage() {
  const [plaintext, setPlaintext] = useState('')
  const [ttl, setTtl] = useState<TtlOption>(DEFAULT_TTL_OPTION)
  const [maxViews, setMaxViews] = useState(MIN_VIEWS)
  const create = useCreateSecret()

  if (create.data) {
    return (
      <CreatedSecretView
        link={create.data.link}
        expiresAt={create.data.expiresAt}
        maxViews={maxViews}
        onReset={() => {
          create.reset()
          setPlaintext('')
        }}
      />
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (plaintext.trim().length === 0) return
    create.mutate({ plaintext, ttl, maxViews })
  }

  const ttlOptions = Object.keys(TTL_OPTIONS) as TtlOption[]
  const viewOptions = Array.from({ length: MAX_VIEWS - MIN_VIEWS + 1 }, (_, i) => MIN_VIEWS + i)

  return (
    <section className="card">
      <h1>Share a secret</h1>
      <p className="muted">
        It&apos;s encrypted in your browser, so we never see it. The link self-destructs after
        it&apos;s viewed.
      </p>
      <form onSubmit={handleSubmit} className="stack">
        <div className="field">
          <label htmlFor="secret">Secret</label>
          <textarea
            id="secret"
            name="secret"
            rows={5}
            required
            placeholder="Paste a password, token, or note…"
            value={plaintext}
            onChange={(event) => setPlaintext(event.target.value)}
          />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="ttl">Expires after</label>
            <select
              id="ttl"
              value={ttl}
              onChange={(event) => setTtl(event.target.value as TtlOption)}
            >
              {ttlOptions.map((option) => (
                <option key={option} value={option}>
                  {TTL_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="views">Max views</label>
            <select
              id="views"
              value={maxViews}
              onChange={(event) => setMaxViews(Number(event.target.value))}
            >
              {viewOptions.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Encrypting…' : 'Create link'}
        </button>
        {create.isError && (
          <p role="alert" className="error">
            Couldn&apos;t create the secret. Please try again.
          </p>
        )}
      </form>
    </section>
  )
}
