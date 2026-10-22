import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/client'
import type { Member } from '../api/members'
import { writeSession } from '../auth/session'
import { createFetchMock, jsonResponse } from '../test/http'
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
})
