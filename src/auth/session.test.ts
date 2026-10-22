import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Session } from './session'
import {
  SESSION_STORAGE_KEY,
  clearSession,
  readSession,
  useSession,
  writeSession,
} from './session'

const session: Session = {
  accessToken: 'test-access-token',
  role: 'member',
  memberId: 42,
}

describe('session store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing has been stored', () => {
    expect(readSession()).toBeNull()
  })

  it('round-trips a session written after login', () => {
    writeSession(session)

    expect(readSession()).toEqual(session)
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()
  })

  it('returns null for malformed stored JSON', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, '{not json')

    expect(readSession()).toBeNull()
  })

  it('returns null when the stored value is not a valid session', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ accessToken: 'test-access-token', role: 'admin', memberId: null }),
    )

    expect(readSession()).toBeNull()
  })

  it('removes the stored session on clearSession', () => {
    writeSession(session)
    clearSession()

    expect(readSession()).toBeNull()
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('reads the persisted session through useSession', () => {
    writeSession(session)

    const { result } = renderHook(() => useSession())

    expect(result.current).toEqual(session)
  })

  it('reports no session through useSession when none was written', () => {
    const { result } = renderHook(() => useSession())

    expect(result.current).toBeNull()
  })
})
