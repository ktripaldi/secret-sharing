// Shared date formatter so user-facing dates are consistent and testable
// (STANDARDS §2.6 — never call toLocaleString directly in a component).

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDateTime(epochMs: number): string {
  return dateTimeFormat.format(new Date(epochMs))
}
