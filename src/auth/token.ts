export interface DecodedAccessToken {
  sub?: number
  role?: string
  memberId?: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function base64UrlToBase64(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = base64.length % 4

  return remainder === 0 ? base64 : base64 + '='.repeat(4 - remainder)
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }

  return undefined
}

/**
 * Reads the claims the login screen needs out of the access token payload.
 * The signature is not verified here: the client has no key, and the token is
 * only used to display the caller's own role and memberId.
 */
export function decodeAccessToken(token: string): DecodedAccessToken | null {
  const segments = token.split('.')

  if (segments.length < 2) {
    return null
  }

  const payloadSegment = segments[1]

  if (!payloadSegment) {
    return null
  }

  let payload: unknown

  try {
    payload = JSON.parse(atob(base64UrlToBase64(payloadSegment)))
  } catch {
    return null
  }

  if (!isRecord(payload)) {
    return null
  }

  const decoded: DecodedAccessToken = {}

  const sub = toNumberOrUndefined(payload.sub)
  if (sub !== undefined) {
    decoded.sub = sub
  }

  if (typeof payload.role === 'string') {
    decoded.role = payload.role
  }

  if (payload.memberId === null) {
    decoded.memberId = null
  } else {
    const memberId = toNumberOrUndefined(payload.memberId)
    if (memberId !== undefined) {
      decoded.memberId = memberId
    }
  }

  return decoded
}
