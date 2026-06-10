import { type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { usePeekSecret, useRevealSecret } from './use-secrets.ts'
import { readKeyFromHash } from '@/lib/secret-link.ts'
import { ApiError } from '@/lib/api-client.ts'

export function ViewSecretPage() {
  const { id = '' } = useParams()
  const key = readKeyFromHash(window.location.hash)
  const peek = usePeekSecret(id)
  const reveal = useRevealSecret()

  if (!key) {
    return <Notice tone="error">This link is missing its key, so the secret can&apos;t be opened.</Notice>
  }
  if (peek.isLoading) {
    return <Notice>Loading…</Notice>
  }
  if (peek.isError) {
    return <Notice tone="error">{unavailableMessage(peek.error)}</Notice>
  }
  if (reveal.data !== undefined) {
    return (
      <section className="card">
        <h1>Here&apos;s the secret</h1>
        <pre className="secret" aria-label="Revealed secret">
          {reveal.data}
        </pre>
        <p className="warning">This secret has now been destroyed. Save it somewhere safe.</p>
      </section>
    )
  }

  const remaining = peek.data?.viewsRemaining ?? 0
  return (
    <section className="card">
      <h1>You&apos;ve received a secret</h1>
      <p className="muted">
        Revealing uses 1 of {remaining} remaining view{remaining === 1 ? '' : 's'} and may destroy
        it.
      </p>
      {reveal.isError && (
        <p role="alert" className="error">
          Couldn&apos;t reveal the secret — wrong key, or it was already viewed.
        </p>
      )}
      <button type="button" onClick={() => reveal.mutate({ id, key })} disabled={reveal.isPending}>
        {reveal.isPending ? 'Revealing…' : 'Reveal secret'}
      </button>
    </section>
  )
}

function unavailableMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'not_found') {
    return "This secret doesn't exist. The link may be mistyped."
  }
  return 'This secret is no longer available. It may have been viewed already, or it expired.'
}

function Notice({ children, tone }: { children: ReactNode; tone?: 'error' }) {
  return (
    <section className="card">
      <p role={tone === 'error' ? 'alert' : undefined} className={tone === 'error' ? 'error' : 'muted'}>
        {children}
      </p>
    </section>
  )
}
