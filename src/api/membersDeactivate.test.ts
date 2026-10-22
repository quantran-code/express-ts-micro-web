import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from './client'
import { deactivateMember, getMember } from './members'
import { createFetchMock, firstFetchCall, jsonResponse } from '../test/http'

const ada = {
  id: 42,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
}

describe('deactivateMember', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts to the deactivate path with the bearer token and no body', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, { ...ada, active: false }))

    const result = await deactivateMember('test-access-token', 42)

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(`expected a successful deactivate, got ${result.error}`)
    }

    expect(result.data).toEqual({ ...ada, active: false })
    expect(result.data.active).toBe(false)

    const call = firstFetchCall(fetchMock)
    expect(call.url).toBe(`${API_BASE_URL}/auth/members/42/deactivate`)
    expect(call.init.method).toBe('POST')
    expect(call.init.headers).toEqual({ Authorization: 'Bearer test-access-token' })
    expect(call.init.body).toBeUndefined()
  })

  it('keeps the service error string and status when the caller is not a librarian', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: 'Only a librarian can deactivate an account' }),
    )

    const result = await deactivateMember('test-access-token', 42)

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: 'Only a librarian can deactivate an account',
      requestId: null,
    })
  })

  it('keeps the service error string and status when the member does not exist', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(404, { error: 'Member not found' }))

    const result = await deactivateMember('test-access-token', 999)

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: 'Member not found',
      requestId: null,
    })
  })
})

describe('Member active field', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('still parses a member payload that has no active field', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, ada))

    const result = await getMember('test-access-token', 42)

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(`expected a member, got ${result.error}`)
    }

    expect(result.data).toEqual(ada)
    expect(result.data.active).toBeUndefined()
  })

  it('parses active: false on a deactivated member', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, { ...ada, active: false }))

    const result = await getMember('test-access-token', 42)

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(`expected a member, got ${result.error}`)
    }

    expect(result.data.active).toBe(false)
  })

  it('rejects a member payload whose active is not a boolean', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, { ...ada, active: 'false' }))

    const result = await getMember('test-access-token', 42)

    expect(result).toEqual({
      ok: false,
      status: 200,
      error: 'Unexpected response from the server',
      requestId: null,
    })
  })
})
