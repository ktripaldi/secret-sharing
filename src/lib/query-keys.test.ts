import { describe, it, expect } from 'vitest'
import { queryKeys } from './query-keys.ts'

describe('queryKeys', () => {
  it('namespaces peek keys by id under the secrets root', () => {
    expect(queryKeys.secrets.peek('abc')).toEqual(['secrets', 'peek', 'abc'])
  })
})
