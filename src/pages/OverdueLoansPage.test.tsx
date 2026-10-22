import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/client'
import type { OverdueLoan } from '../api/loans'
import { writeSession } from '../auth/session'
import { createFetchMock, firstFetchCall, jsonResponse } from '../test/http'
import { OverdueLoansPage } from './OverdueLoansPage'

const overdueLoan: OverdueLoan = {
  id: 3,
  bookId: 7,
  memberId: 42,
  borrowedAt: '2025-12-01T00:00:00.000Z',
  returnedAt: null,
  dueDate: '2025-12-15T00:00:00.000Z',
}

function renderOverduePage() {
  render(
    <MemoryRouter initialEntries={['/loans/overdue']}>
      <OverdueLoansPage />
    </MemoryRouter>,
  )
}

function signIn(role: 'member' | 'librarian', memberId: number | null) {
  writeSession({ accessToken: 'test-access-token', role, memberId })
}

describe('OverdueLoansPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('lists the overdue loans for a librarian with the bearer token from the session', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, [overdueLoan]))
    signIn('librarian', null)

    renderOverduePage()

    expect(await screen.findByText('Book 7')).toBeInTheDocument()
    expect(screen.getByText('Member 42')).toBeInTheDocument()
    expect(screen.getByText('Due 2025-12-15T00:00:00.000Z')).toBeInTheDocument()

    const call = firstFetchCall(fetchMock)
    expect(call.url).toBe(`${API_BASE_URL}/loans/overdue`)
    expect(call.init.method).toBe('GET')
    expect(call.init.headers).toEqual({ Authorization: 'Bearer test-access-token' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders an empty state when nothing is overdue', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, []))
    signIn('librarian', null)

    renderOverduePage()

    expect(await screen.findByText('No overdue loans.')).toBeInTheDocument()
    expect(screen.queryByText(/^Book /)).toBeNull()
  })

  it('renders the exact server error string when the overdue list cannot be loaded', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'Overdue loans unavailable' }))
    signIn('librarian', null)

    renderOverduePage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Overdue loans unavailable')
  })

  it('shows the librarian notice for a member and makes no overdue request', async () => {
    const fetchMock = createFetchMock()
    signIn('member', 42)

    renderOverduePage()

    expect(await screen.findByText('Librarians only')).toBeInTheDocument()
    expect(screen.queryByText(/^Book /)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('appends the requestId when the overdue list cannot be loaded', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(500, { error: 'Overdue loans unavailable', requestId: 'req-overdue-500' }),
    )
    signIn('librarian', null)

    renderOverduePage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Overdue loans unavailable (ref: req-overdue-500)')
  })
})
