import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, writeSession } from '../auth/session'
import { createFetchMock, firstFetchCall, jsonResponse } from '../test/http'
import {
  API_BASE_URL,
  formatApiError,
  formatPageError,
  isRecord,
  loginUser,
  registerUser,
  requestJson,
  requestVoid,
  setSessionExpiredHandler,
} from './client'
import type { ApiResult } from './client'

interface Probe {
  id: number
}

function isProbe(payload: unknown): payload is Probe {
  return isRecord(payload) && typeof payload.id === 'number'
}

function failureOf(result: ApiResult<unknown>): Extract<ApiResult<unknown>, { ok: false }> {
  if (result.ok) {
    throw new Error('expected a failed result')
  }

  return result
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear()
    setSessionExpiredHandler(null)
  })

  afterEach(() => {
    clearSession()
    setSessionExpiredHandler(null)
    vi.unstubAllGlobals()
  })

  it('attaches the bearer token it is given and returns the parsed success body', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 7 }))

    const result = await requestJson(
      '/books/7',
      { method: 'GET', accessToken: 'token-abc' },
      isProbe,
    )

    expect(result).toEqual({ ok: true, data: { id: 7 } })

    const call = firstFetchCall(fetchMock)
    expect(call.url).toBe(`${API_BASE_URL}/books/7`)
    expect(call.init.method).toBe('GET')
    expect(call.init.headers).toEqual({ Authorization: 'Bearer token-abc' })
    expect(call.init.body).toBeUndefined()
  })

  it('falls back to the token in the stored session when the caller passes none', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 7 }))
    writeSession({ accessToken: 'stored-token', role: 'member', memberId: 42 })

    await requestJson('/books/7', { method: 'GET', accessToken: '' }, isProbe)

    expect(firstFetchCall(fetchMock).init.headers).toEqual({
      Authorization: 'Bearer stored-token',
    })
  })

  it('returns the error message and requestId of a non-2xx body', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(409, { error: 'ISBN already exists', requestId: 'req-409' }),
    )

    const result = await requestJson(
      '/books',
      { method: 'POST', accessToken: 'token-abc', body: { title: 'Dune' } },
      isProbe,
    )

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'ISBN already exists',
      requestId: 'req-409',
    })

    const call = firstFetchCall(fetchMock)
    expect(call.init.headers).toEqual({
      Authorization: 'Bearer token-abc',
      'Content-Type': 'application/json',
    })
    expect(call.init.body).toBe('{"title":"Dune"}')
  })

  it('leaves requestId null when the error body does not carry one', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'Member service unavailable' }))

    const result = await requestJson(
      '/members',
      { method: 'GET', accessToken: 'token-abc' },
      isProbe,
    )

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: 'Member service unavailable',
      requestId: null,
    })
  })

  it('leaves requestId null when the error body is not JSON', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      new Response('bad gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } }),
    )

    const result = await requestJson(
      '/reports/most-borrowed',
      { method: 'GET', accessToken: 'token-abc' },
      isProbe,
    )

    expect(result).toEqual({
      ok: false,
      status: 502,
      error: 'Unexpected response from the server',
      requestId: null,
    })
  })

  it('leaves requestId null when the request never reaches the server', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await requestJson(
      '/books',
      { method: 'GET', accessToken: 'token-abc' },
      isProbe,
    )

    expect(result).toEqual({
      ok: false,
      status: 0,
      error: 'Unable to reach the server',
      requestId: null,
    })
  })

  it('returns ok with null data for a 204 response to a void request', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    const result = await requestVoid('/members/42', { method: 'DELETE', accessToken: 'token-abc' })

    expect(result).toEqual({ ok: true, data: null })

    const call = firstFetchCall(fetchMock)
    expect(call.init.method).toBe('DELETE')
    expect(call.init.headers).toEqual({ Authorization: 'Bearer token-abc' })
  })

  it('returns the error message and requestId of a failed void request', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: 'Cannot delete a member with active loans',
        requestId: 'req-409',
      }),
    )

    const result = await requestVoid('/members/42', { method: 'DELETE', accessToken: 'token-abc' })

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'Cannot delete a member with active loans',
      requestId: 'req-409',
    })
  })

  it('appends the requestId when formatting a failure that carries one', () => {
    const rendered = formatApiError({
      ok: false,
      status: 409,
      error: 'ISBN already exists',
      requestId: 'req-409',
    })

    expect(rendered).toBe('ISBN already exists (ref: req-409)')
  })

  it('renders the message alone when formatting a failure without a requestId', () => {
    const rendered = formatApiError({
      ok: false,
      status: 0,
      error: 'Unable to reach the server',
      requestId: null,
    })

    expect(rendered).toBe('Unable to reach the server')
  })

  it('renders nothing for a page slot when an authenticated call answers 401', () => {
    const rendered = formatPageError({
      ok: false,
      status: 401,
      error: 'Invalid or expired token',
      requestId: 'req-401',
    })

    expect(rendered).toBeNull()
  })

  it('renders the message with its requestId for a page slot on a non-401 failure', () => {
    const rendered = formatPageError({
      ok: false,
      status: 403,
      error: 'Librarian role required',
      requestId: 'req-403',
    })

    expect(rendered).toBe('Librarian role required (ref: req-403)')
  })

  it('calls the session-expired handler when an authenticated call answers 401', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'Invalid or expired token', requestId: 'req-401' }),
    )
    const handler = vi.fn()
    setSessionExpiredHandler(handler)

    const result = await requestJson(
      '/members',
      { method: 'GET', accessToken: 'expired-token' },
      isProbe,
    )

    expect(handler).toHaveBeenCalledTimes(1)
    expect(failureOf(result)).toEqual({
      ok: false,
      status: 401,
      error: 'Invalid or expired token',
      requestId: 'req-401',
    })
  })

  it('calls the session-expired handler for a 401 on an authenticated void request', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Invalid or expired token' }))
    const handler = vi.fn()
    setSessionExpiredHandler(handler)

    const result = await requestVoid('/members/42', {
      method: 'DELETE',
      accessToken: 'expired-token',
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(failureOf(result).status).toBe(401)
  })

  it('does not call the session-expired handler for a non-401 failure', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: 'Librarian role required', requestId: 'req-403' }),
    )
    const handler = vi.fn()
    setSessionExpiredHandler(handler)

    const result = await requestJson(
      '/members',
      { method: 'GET', accessToken: 'token-abc' },
      isProbe,
    )

    expect(handler).not.toHaveBeenCalled()
    expect(failureOf(result).status).toBe(403)
  })

  it('never calls the session-expired handler for a 401 from login or register', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(401, { error: 'Invalid credentials', requestId: 'req-401' })),
    )
    const handler = vi.fn()
    setSessionExpiredHandler(handler)

    const loginResult = await loginUser({ email: 'ada@library.test', password: 'nope' })
    const registerResult = await registerUser({
      name: 'Ada',
      email: 'ada@library.test',
      password: 'nope',
      role: 'member',
    })

    expect(handler).not.toHaveBeenCalled()
    expect(failureOf(loginResult).error).toBe('Invalid credentials')
    expect(failureOf(registerResult).requestId).toBe('req-401')

    expect(fetchMock).toHaveBeenCalledTimes(2)

    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    }
  })
})
