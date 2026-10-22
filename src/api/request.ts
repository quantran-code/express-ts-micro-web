import { API_BASE_URL } from './client'
import type { ApiResult } from './client'

const UNREACHABLE_MESSAGE = 'Unable to reach the server'
const UNEXPECTED_MESSAGE = 'Unexpected response from the server'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Keeps the error message the service sent, so callers can render it verbatim.
 */
function readErrorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === 'string') {
    return payload.error
  }

  return UNEXPECTED_MESSAGE
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export interface JsonRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  accessToken: string
  body?: unknown
}

/**
 * Calls the authenticated JSON endpoints with the accessToken stored at login and
 * keeps both the status and the service's error string for the calling page.
 */
export async function requestJson<T>(
  path: string,
  request: JsonRequest,
  isExpected: (payload: unknown) => payload is T,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${request.accessToken}`,
  }

  if (request.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, init)
  } catch {
    return { ok: false, status: 0, error: UNREACHABLE_MESSAGE }
  }

  const payload = await readJson(response)

  if (response.status < 200 || response.status >= 300) {
    return { ok: false, status: response.status, error: readErrorMessage(payload) }
  }

  if (!isExpected(payload)) {
    return { ok: false, status: response.status, error: UNEXPECTED_MESSAGE }
  }

  return { ok: true, status: response.status, data: payload }
}

/**
 * Calls the authenticated endpoints that answer with an empty success body, such
 * as a 204 after a delete, and keeps the service's error string for the caller.
 */
export async function requestVoid(
  path: string,
  request: Omit<JsonRequest, 'body'>,
): Promise<ApiResult<null>> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${request.accessToken}`,
      },
    })
  } catch {
    return { ok: false, status: 0, error: UNREACHABLE_MESSAGE }
  }

  if (response.status < 200 || response.status >= 300) {
    const payload = await readJson(response)

    return { ok: false, status: response.status, error: readErrorMessage(payload) }
  }

  return { ok: true, status: response.status, data: null }
}
