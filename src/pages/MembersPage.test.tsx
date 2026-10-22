import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/client'
import type { Member } from '../api/members'
import { writeSession } from '../auth/session'
import { createAccessToken, createFetchMock, jsonResponse } from '../test/http'
import type { FetchCall, FetchMock } from '../test/http'
import { MembersPage } from './MembersPage'

const ada: Member = {
  id: 42,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
}

const grace: Member = {
  id: 43,
  name: 'Grace Hopper',
  email: 'grace@example.com',
}

const membersUrl = `${API_BASE_URL}/members`
const adaDeactivateUrl = `${API_BASE_URL}/auth/members/42/deactivate`

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

function allCalls(fetchMock: FetchMock): FetchCall[] {
  const calls: FetchCall[] = []

  for (const [input, init] of fetchMock.mock.calls) {
    if (init === undefined) {
      continue
    }

    calls.push({ url: urlOf(input), init })
  }

  return calls
}

function callsFor(fetchMock: FetchMock, method: string, url: string): FetchCall[] {
  return allCalls(fetchMock).filter((call) => call.init.method === method && call.url === url)
}

function singleCall(fetchMock: FetchMock, method: string, url: string): FetchCall {
  const [call] = callsFor(fetchMock, method, url)

  if (call === undefined) {
    throw new Error(`expected a ${method} ${url} call`)
  }

  return call
}

function signIn(role: 'member' | 'librarian', memberId: number | null) {
  writeSession({ accessToken: 'test-access-token', role, memberId })
}

/**
 * The Deactivate button is gated on the role claim decoded from the access token,
 * so those tests need a token the decoder can actually read.
 */
function signInWithToken(role: 'member' | 'librarian', memberId: number | null) {
  writeSession({ accessToken: createAccessToken({ role, memberId }), role, memberId })
}

function renderMembersPage() {
  render(<MembersPage />)
}

describe('MembersPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('lists every member with the bearer token for a librarian', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, [ada, grace]))
    signIn('librarian', null)

    renderMembersPage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('grace@example.com')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2)

    const call = singleCall(fetchMock, 'GET', membersUrl)
    expect(call.init.headers).toEqual({ Authorization: 'Bearer test-access-token' })
  })

  it('shows the librarian notice and makes no request for a member', async () => {
    const fetchMock = createFetchMock()
    signIn('member', 42)

    renderMembersPage()

    expect(await screen.findByText('Librarians only')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends DELETE and removes the row when the delete succeeds', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }))
      }

      return Promise.resolve(jsonResponse(200, [ada, grace]))
    })
    signIn('librarian', null)

    renderMembersPage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    const [firstDelete] = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(firstDelete)

    await waitFor(() => {
      expect(screen.queryByText('Ada Lovelace')).toBeNull()
    })
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()

    const deleteCall = singleCall(fetchMock, 'DELETE', `${API_BASE_URL}/members/42`)
    expect(deleteCall.init.headers).toEqual({ Authorization: 'Bearer test-access-token' })
  })

  it('renders the exact 409 message next to the row and keeps the member listed', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(
          jsonResponse(409, { error: 'Cannot delete a member with active loans' }),
        )
      }

      return Promise.resolve(jsonResponse(200, [ada, grace]))
    })
    signIn('librarian', null)

    renderMembersPage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    const [firstDelete] = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(firstDelete)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Cannot delete a member with active loans')
    expect(alert.closest('li')?.textContent).toContain('Ada Lovelace')
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('renders the exact service error when the member list cannot be loaded', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'Member service unavailable' }))
    signIn('librarian', null)

    renderMembersPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Member service unavailable')
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('shows a Deactivate button beside Delete for a librarian token', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, [ada, grace]))
    signInWithToken('librarian', null)

    renderMembersPage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Deactivate' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2)
    expect(screen.queryByText('Inactive')).toBeNull()

    const [firstDeactivateButton] = screen.getAllByRole('button', { name: 'Deactivate' })
    expect(firstDeactivateButton.className).toBe('deactivate-button')
  })

  it('keeps the Deactivate button hidden for a member token', async () => {
    const fetchMock = createFetchMock()
    signInWithToken('member', 42)

    renderMembersPage()

    expect(await screen.findByText('Librarians only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('marks the row inactive in place when the deactivate succeeds', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'POST' && urlOf(input) === adaDeactivateUrl) {
        return Promise.resolve(jsonResponse(200, { ...ada, active: false }))
      }

      return Promise.resolve(jsonResponse(200, [ada, grace]))
    })
    signInWithToken('librarian', null)

    renderMembersPage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    const [firstDeactivate] = screen.getAllByRole('button', { name: 'Deactivate' })
    fireEvent.click(firstDeactivate)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Deactivate' })).toHaveLength(1)
    })

    const badge = screen.getByText('Inactive')
    expect(badge.className).toBe('inactive-badge')
    expect(badge.closest('li')?.textContent).toContain('Ada Lovelace')
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2)

    expect(callsFor(fetchMock, 'POST', adaDeactivateUrl)).toHaveLength(1)
    expect(singleCall(fetchMock, 'POST', adaDeactivateUrl).init.body).toBeUndefined()
    expect(callsFor(fetchMock, 'GET', membersUrl)).toHaveLength(1)
  })

  it('shows the Inactive badge and no Deactivate button for a deactivated member', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, [{ ...ada, active: false }, grace]))
    signInWithToken('librarian', null)

    renderMembersPage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    const badge = screen.getByText('Inactive')
    expect(badge.closest('li')?.textContent).toContain('Ada Lovelace')

    const [onlyDeactivate] = screen.getAllByRole('button', { name: 'Deactivate' })
    expect(onlyDeactivate.closest('li')?.textContent).toContain('Grace Hopper')
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2)
  })

  it('renders the exact deactivate error next to the row and keeps it active', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'POST' && urlOf(input) === adaDeactivateUrl) {
        return Promise.resolve(
          jsonResponse(403, { error: 'Only a librarian can deactivate an account' }),
        )
      }

      return Promise.resolve(jsonResponse(200, [ada, grace]))
    })
    signInWithToken('librarian', null)

    renderMembersPage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    const [firstDeactivate] = screen.getAllByRole('button', { name: 'Deactivate' })
    fireEvent.click(firstDeactivate)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Only a librarian can deactivate an account')
    expect(alert.closest('li')?.textContent).toContain('Ada Lovelace')
    expect(screen.queryByText('Inactive')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Deactivate' })).toHaveLength(2)
  })

  it('appends the requestId when the member list cannot be loaded', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(500, { error: 'Member service unavailable', requestId: 'req-members-500' }),
    )
    signIn('librarian', null)

    renderMembersPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Member service unavailable (ref: req-members-500)')
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('appends the requestId next to the row when a delete is refused', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(
          jsonResponse(409, {
            error: 'Cannot delete a member with active loans',
            requestId: 'req-delete-409',
          }),
        )
      }

      return Promise.resolve(jsonResponse(200, [ada, grace]))
    })
    signIn('librarian', null)

    renderMembersPage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    const [firstDelete] = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(firstDelete)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Cannot delete a member with active loans (ref: req-delete-409)')
    expect(alert.closest('li')?.textContent).toContain('Ada Lovelace')
  })

  it('appends the requestId next to the row when a deactivate is refused', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'POST' && urlOf(input) === adaDeactivateUrl) {
        return Promise.resolve(
          jsonResponse(403, {
            error: 'Only a librarian can deactivate an account',
            requestId: 'req-deactivate-403',
          }),
        )
      }

      return Promise.resolve(jsonResponse(200, [ada, grace]))
    })
    signInWithToken('librarian', null)

    renderMembersPage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    const [firstDeactivate] = screen.getAllByRole('button', { name: 'Deactivate' })
    fireEvent.click(firstDeactivate)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(
      'Only a librarian can deactivate an account (ref: req-deactivate-403)',
    )
    expect(alert.closest('li')?.textContent).toContain('Ada Lovelace')
    expect(screen.queryByText('Inactive')).toBeNull()
  })
})
