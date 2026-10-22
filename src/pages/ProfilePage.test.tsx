import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/client'
import type { Loan } from '../api/loans'
import type { Member } from '../api/members'
import { writeSession } from '../auth/session'
import { createFetchMock, jsonResponse, readJsonBody } from '../test/http'
import type { FetchCall, FetchMock } from '../test/http'
import { ProfilePage } from './ProfilePage'

const member: Member = {
  id: 42,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
}

const firstLoan: Loan = {
  id: 3,
  bookId: 7,
  memberId: 42,
  borrowedAt: '2026-01-05T00:00:00.000Z',
  returnedAt: null,
}

const secondLoan: Loan = {
  id: 4,
  bookId: 9,
  memberId: 42,
  borrowedAt: '2026-01-06T00:00:00.000Z',
  returnedAt: null,
}

const memberUrl = `${API_BASE_URL}/members/42`
const loansUrl = `${API_BASE_URL}/members/42/loans`

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

function renderProfilePage() {
  render(<ProfilePage />)
}

function fillEditForm(name: string, email: string) {
  fireEvent.change(screen.getByLabelText('Edit name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Edit email'), { target: { value: email } })
}

describe('ProfilePage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('loads the member with the bearer token and renders the name and email', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, []))
      }

      return Promise.resolve(jsonResponse(200, member))
    })
    signIn('member', 42)

    renderProfilePage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()

    const call = singleCall(fetchMock, 'GET', memberUrl)
    expect(call.init.headers).toEqual({ Authorization: 'Bearer test-access-token' })
  })

  it('updates the rendered values from the PATCH response without fetching the member again', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input, init) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, []))
      }

      if (init?.method === 'PATCH') {
        return Promise.resolve(
          jsonResponse(200, { id: 42, name: 'Ada Byron', email: 'ada.byron@example.com' }),
        )
      }

      return Promise.resolve(jsonResponse(200, member))
    })
    signIn('member', 42)

    renderProfilePage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    fillEditForm('Ada Byron', 'ada.byron@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Ada Byron')).toBeInTheDocument()
    expect(screen.getByText('ada.byron@example.com')).toBeInTheDocument()
    expect(screen.queryByText('ada@example.com')).toBeNull()

    const patchCall = singleCall(fetchMock, 'PATCH', memberUrl)
    expect(patchCall.init.headers).toEqual({
      Authorization: 'Bearer test-access-token',
      'Content-Type': 'application/json',
    })
    expect(readJsonBody(patchCall.init)).toEqual({
      name: 'Ada Byron',
      email: 'ada.byron@example.com',
    })

    expect(callsFor(fetchMock, 'GET', memberUrl)).toHaveLength(1)
  })

  it('renders the exact 409 message and keeps the previous values when the email is taken', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input, init) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, []))
      }

      if (init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse(409, { error: 'Email already registered' }))
      }

      return Promise.resolve(jsonResponse(200, member))
    })
    signIn('member', 42)

    renderProfilePage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    fillEditForm('Ada Lovelace', 'taken@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Email already registered')
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })

  it('shows a validation message and sends no PATCH when the email is not an address', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, []))
      }

      return Promise.resolve(jsonResponse(200, member))
    })
    signIn('member', 42)

    renderProfilePage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    fillEditForm('Ada Lovelace', 'not-an-email')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Enter a valid email address')
    expect(callsFor(fetchMock, 'PATCH', memberUrl)).toHaveLength(0)
  })

  it('renders no profile form and no loans section when the session has no member id', async () => {
    const fetchMock = createFetchMock()
    signIn('librarian', null)

    renderProfilePage()

    expect(await screen.findByText('No member profile for this account')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
    expect(screen.queryByText('My loans')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lists the active loans with their book and borrow date', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, [firstLoan, secondLoan]))
      }

      return Promise.resolve(jsonResponse(200, member))
    })
    signIn('member', 42)

    renderProfilePage()

    expect(await screen.findByText('Book 7')).toBeInTheDocument()
    expect(screen.getByText('Book 9')).toBeInTheDocument()
    expect(screen.getByText(/Borrowed 2026-01-05T00:00:00.000Z/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Return' })).toHaveLength(2)

    const call = singleCall(fetchMock, 'GET', loansUrl)
    expect(call.init.headers).toEqual({ Authorization: 'Bearer test-access-token' })
  })

  it('returns a loan and drops it from the list without a reload', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input, init) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, [firstLoan, secondLoan]))
      }

      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(200, { ...firstLoan, returnedAt: '2026-01-07T00:00:00.000Z' }),
        )
      }

      return Promise.resolve(jsonResponse(200, member))
    })
    signIn('member', 42)

    renderProfilePage()

    expect(await screen.findByText('Book 7')).toBeInTheDocument()

    const [firstReturn] = screen.getAllByRole('button', { name: 'Return' })
    fireEvent.click(firstReturn)

    await waitFor(() => {
      expect(screen.queryByText('Book 7')).toBeNull()
    })
    expect(screen.getByText('Book 9')).toBeInTheDocument()

    const returnCall = singleCall(fetchMock, 'POST', `${API_BASE_URL}/loans/3/return`)
    expect(returnCall.init.headers).toEqual({ Authorization: 'Bearer test-access-token' })
    expect(callsFor(fetchMock, 'GET', loansUrl)).toHaveLength(1)
  })

  it('keeps the loan and renders the exact error message when the return is refused', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input, init) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, [firstLoan, secondLoan]))
      }

      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(409, { error: 'Loan already returned' }))
      }

      return Promise.resolve(jsonResponse(200, member))
    })
    signIn('member', 42)

    renderProfilePage()

    expect(await screen.findByText('Book 7')).toBeInTheDocument()

    const [firstReturn] = screen.getAllByRole('button', { name: 'Return' })
    fireEvent.click(firstReturn)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Loan already returned')
    expect(screen.getByText('Book 7')).toBeInTheDocument()
    expect(screen.getByText('Book 9')).toBeInTheDocument()
  })

  it('appends the requestId when the profile cannot be loaded', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, []))
      }

      return Promise.resolve(
        jsonResponse(500, { error: 'Member service unavailable', requestId: 'req-profile-500' }),
      )
    })
    signIn('member', 42)

    renderProfilePage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Member service unavailable (ref: req-profile-500)')
  })

  it('appends the requestId when the save is refused', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input, init) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, []))
      }

      if (init?.method === 'PATCH') {
        return Promise.resolve(
          jsonResponse(409, { error: 'Email already registered', requestId: 'req-patch-409' }),
        )
      }

      return Promise.resolve(jsonResponse(200, member))
    })
    signIn('member', 42)

    renderProfilePage()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    fillEditForm('Ada Lovelace', 'taken@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Email already registered (ref: req-patch-409)')
  })

  it('appends the requestId when the return is refused', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input, init) => {
      if (urlOf(input) === loansUrl) {
        return Promise.resolve(jsonResponse(200, [firstLoan, secondLoan]))
      }

      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(409, { error: 'Loan already returned', requestId: 'req-return-409' }),
        )
      }

      return Promise.resolve(jsonResponse(200, member))
    })
    signIn('member', 42)

    renderProfilePage()

    expect(await screen.findByText('Book 7')).toBeInTheDocument()

    const [firstReturn] = screen.getAllByRole('button', { name: 'Return' })
    fireEvent.click(firstReturn)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Loan already returned (ref: req-return-409)')
    expect(screen.getByText('Book 7')).toBeInTheDocument()
  })
})
