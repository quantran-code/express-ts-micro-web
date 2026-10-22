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
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string }

const UNREACHABLE_MESSAGE = 'Unable to reach the server'
const UNEXPECTED_MESSAGE = 'Unexpected response from the server'

function isRecord(value: unknown): value is Record<string, unknown> {
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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * POSTs the documented JSON body to the auth-service path. The x-service-key header
 * is injected by the api-gateway, so the client never sends it.
 */
async function postJson<T>(
  path: string,
  body: unknown,
  isExpected: (payload: unknown) => payload is T,
): Promise<ApiResult<T>> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
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

export function loginUser(body: LoginRequestBody): Promise<ApiResult<LoginResponse>> {
  return postJson('/auth/login', body, isLoginResponse)
}

export function registerUser(body: RegisterRequestBody): Promise<ApiResult<RegisterResponse>> {
  return postJson('/auth/register', body, isRegisterResponse)
}
