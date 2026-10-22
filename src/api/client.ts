import { readSession } from '../auth/session'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export type AuthRole = 'member' | 'librarian'

export interface LoginResponse {
  accessToken: string
  tokenType: string
  role: AuthRole
}

export interface RegisterResponse {
  id: number
  memberId: number
  name: string
  email: string
  role: AuthRole
}

export interface LoginRequestBody {
  email: string
  password: string
}

export interface RegisterRequestBody {
  name: string
  email: string
  password: string
  role: AuthRole
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; requestId: string | null; status: number }

export interface JsonRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  accessToken: string
  body?: unknown
}

/**
 * Called by the client when an authenticated request answers 401, so the redirect
 * to the login screen lives in one place instead of in every page.
 */
export type SessionExpiredHandler = () => void

const UNREACHABLE_MESSAGE = 'Unable to reach the server'
const UNEXPECTED_MESSAGE = 'Unexpected response from the server'

let sessionExpiredHandler: SessionExpiredHandler | null = null

/**
 * Replaces the single session-expired slot; pass null to unregister.
 */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'member' || value === 'librarian'
}

function isLoginResponse(payload: unknown): payload is LoginResponse {
  return (
    isRecord(payload) && typeof payload.accessToken === 'string' && isAuthRole(payload.role)
  )
}

function isRegisterResponse(payload: unknown): payload is RegisterResponse {
  return (
    isRecord(payload) &&
    typeof payload.id === 'number' &&
    typeof payload.email === 'string' &&
    isAuthRole(payload.role)
  )
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

/**
 * Keeps the correlation id the gateway or the backing service put beside the
 * error. Services that do not emit one leave it absent, hence null.
 */
function readRequestId(payload: unknown): string | null {
  if (isRecord(payload) && typeof payload.requestId === 'string' && payload.requestId !== '') {
    return payload.requestId
  }

  return null
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function resolveAccessToken(accessToken: string): string | null {
  if (accessToken !== '') {
    return accessToken
  }

  return readSession()?.accessToken ?? null
}

function notifySessionExpired(token: string | null, status: number): void {
  if (status !== 401 || token === null) {
    return
  }

  sessionExpiredHandler?.()
}

function buildHeaders(token: string | null, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {}

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  if (hasBody) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

async function send(path: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, init)
  } catch {
    return null
  }
}

interface JsonCall<T> {
  path: string
  method: JsonRequest['method']
  token: string | null
  body?: unknown
  isExpected: (payload: unknown) => payload is T
}

async function sendJson<T>(call: JsonCall<T>): Promise<ApiResult<T>> {
  const response = await send(call.path, {
    method: call.method,
    headers: buildHeaders(call.token, call.body !== undefined),
    body: call.body === undefined ? undefined : JSON.stringify(call.body),
  })

  if (response === null) {
    return { ok: false, status: 0, error: UNREACHABLE_MESSAGE, requestId: null }
  }

  const payload = await readJson(response)

  if (response.status < 200 || response.status >= 300) {
    notifySessionExpired(call.token, response.status)

    return {
      ok: false,
      status: response.status,
      error: readErrorMessage(payload),
      requestId: readRequestId(payload),
    }
  }

  if (!call.isExpected(payload)) {
    return { ok: false, status: response.status, error: UNEXPECTED_MESSAGE, requestId: null }
  }

  return { ok: true, data: payload }
}

/**
 * Calls the authenticated JSON endpoints with the accessToken stored at login and
 * keeps the status, the service's error string and its requestId for the page.
 */
export function requestJson<T>(
  path: string,
  request: JsonRequest,
  isExpected: (payload: unknown) => payload is T,
): Promise<ApiResult<T>> {
  return sendJson({
    path,
    method: request.method,
    token: resolveAccessToken(request.accessToken),
    body: request.body,
    isExpected,
  })
}

/**
 * Calls the authenticated endpoints that answer with an empty success body, such
 * as a 204 after a delete, and keeps the service's error string for the caller.
 */
export async function requestVoid(
  path: string,
  request: Omit<JsonRequest, 'body'>,
): Promise<ApiResult<null>> {
  const token = resolveAccessToken(request.accessToken)

  const response = await send(path, {
    method: request.method,
    headers: buildHeaders(token, false),
  })

  if (response === null) {
    return { ok: false, status: 0, error: UNREACHABLE_MESSAGE, requestId: null }
  }

  if (response.status < 200 || response.status >= 300) {
    notifySessionExpired(token, response.status)

    const payload = await readJson(response)

    return {
      ok: false,
      status: response.status,
      error: readErrorMessage(payload),
      requestId: readRequestId(payload),
    }
  }

  return { ok: true, data: null }
}

/**
 * Renders the failure as the service message with its correlation id appended, and
 * as the message alone when the hop that failed did not report one.
 */
export function formatApiError(result: Extract<ApiResult<unknown>, { ok: false }>): string {
  const requestId = result.requestId

  if (typeof requestId === 'string' && requestId !== '') {
    return `${result.error} (ref: ${requestId})`
  }

  return result.error
}

/**
 * The page-level variant: a 401 on an authenticated call is answered by the
 * session-expired redirect, so it renders nothing in the page's error slot.
 */
export function formatPageError(
  result: Extract<ApiResult<unknown>, { ok: false }>,
): string | null {
  if (result.status === 401) {
    return null
  }

  return formatApiError(result)
}

/**
 * The unauthenticated pair: no bearer token is attached and a 401 is an ordinary
 * inline error, so a wrong password never looks like an expired session.
 */
export function loginUser(body: LoginRequestBody): Promise<ApiResult<LoginResponse>> {
  return sendJson({
    path: '/auth/login',
    method: 'POST',
    token: null,
    body,
    isExpected: isLoginResponse,
  })
}

export function registerUser(body: RegisterRequestBody): Promise<ApiResult<RegisterResponse>> {
  return sendJson({
    path: '/auth/register',
    method: 'POST',
    token: null,
    body,
    isExpected: isRegisterResponse,
  })
}
