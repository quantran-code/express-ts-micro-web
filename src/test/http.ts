import { vi } from 'vitest'

/**
 * Test helpers shared by the page suites: they stub global fetch (never a live
 * server) and read back the request they captured.
 */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function createFetchMock() {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export type FetchMock = ReturnType<typeof createFetchMock>

export interface FetchCall {
  url: string
  init: RequestInit
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

export function firstFetchCall(fetchMock: FetchMock): FetchCall {
  const call = fetchMock.mock.calls[0]

  if (call === undefined) {
    throw new Error('fetch was not called')
  }

  const init = call[1]

  if (init === undefined) {
    throw new Error('fetch was called without an init argument')
  }

  return { url: requestUrl(call[0]), init }
}

export function readJsonBody(init: RequestInit): unknown {
  const body = init.body

  if (typeof body !== 'string') {
    throw new Error('expected a JSON string request body')
  }

  return JSON.parse(body)
}

function base64UrlEncode(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Builds an unsigned token whose payload the login page can decode.
 */
export function createAccessToken(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' }

  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.test-signature`
}
