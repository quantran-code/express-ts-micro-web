import { useState } from 'react'
import type { AuthRole } from '../api/client'

export interface Session {
  accessToken: string
  role: AuthRole
  memberId: number | null
}

export const SESSION_STORAGE_KEY = 'library-portal.session'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'member' || value === 'librarian'
}

function toSession(value: unknown): Session | null {
  if (!isRecord(value)) {
    return null
  }

  if (typeof value.accessToken !== 'string' || value.accessToken === '') {
    return null
  }

  if (!isAuthRole(value.role)) {
    return null
  }

  const memberId = value.memberId

  if (memberId !== null && memberId !== undefined && typeof memberId !== 'number') {
    return null
  }

  return {
    accessToken: value.accessToken,
    role: value.role,
    memberId: typeof memberId === 'number' ? memberId : null,
  }
}

/**
 * Persists the signed-in session so routes other than the login screen can read
 * the accessToken and role the auth-service returned.
 */
export function writeSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage can be unavailable (private mode, quota); the session is still usable in memory.
  }
}

export function readSession(): Session | null {
  let stored: string | null

  try {
    stored = localStorage.getItem(SESSION_STORAGE_KEY)
  } catch {
    return null
  }

  if (stored === null) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(stored)
  } catch {
    return null
  }

  return toSession(parsed)
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/**
 * Reads the persisted session once, for pages that only need the state as it
 * was when the route mounted.
 */
export function useSession(): Session | null {
  const [session] = useState<Session | null>(() => readSession())

  return session
}
