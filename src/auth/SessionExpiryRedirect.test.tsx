import { cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isRecord, requestJson } from '../api/client'
import { LoginPage } from '../pages/LoginPage'
import { createFetchMock, jsonResponse } from '../test/http'
import { clearSession, readSession, writeSession } from './session'
import { SessionExpiryRedirect } from './SessionExpiryRedirect'

interface Probe {
  id: number
}

function isProbe(payload: unknown): payload is Probe {
  return isRecord(payload) && typeof payload.id === 'number'
}

interface ProbeScreenProps {
  accessToken: string
}

function ProbeScreen({ accessToken }: ProbeScreenProps) {
  useEffect(() => {
    void requestJson('/books', { method: 'GET', accessToken }, isProbe)
  }, [accessToken])

  return <p>Books screen</p>
}

function renderProbe(accessToken: string) {
  render(
    <MemoryRouter initialEntries={['/books']}>
      <SessionExpiryRedirect />
      <Routes>
        <Route path="/books" element={<ProbeScreen accessToken={accessToken} />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SessionExpiryRedirect', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    clearSession()
  })

  it('clears the stored session and redirects to the login screen on a 401', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'Invalid or expired token', requestId: 'req-401' }),
    )
    writeSession({ accessToken: 'stored-token', role: 'member', memberId: 42 })

    renderProbe('')

    const banner = await screen.findByText('Your session expired, please log in again')
    expect(banner.className).toContain('form-error')
    expect(banner.className).toContain('session-expired')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(readSession()).toBeNull()
    expect(screen.queryByText(/Invalid or expired token/)).toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('leaves the screen alone when the 401 came from a call with no token', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'Invalid or expired token', requestId: 'req-401' }),
    )

    renderProbe('')

    expect(await screen.findByText('Books screen')).toBeInTheDocument()
    expect(screen.queryByText('Your session expired, please log in again')).toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
