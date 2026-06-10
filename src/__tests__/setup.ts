import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Without globals enabled, RTL's auto-cleanup isn't registered — unmount between tests.
afterEach(() => {
  cleanup()
})
