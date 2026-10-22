import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { formatApiError, isRecord, loginUser } from '../api/client'
import type { AuthRole } from '../api/client'
import { decodeAccessToken } from '../auth/token'
import { writeSession } from '../auth/session'

interface Session {
  accessToken: string
  role: AuthRole
  memberId: number | null | undefined
}

export function LoginPage() {
  const location = useLocation()
  const sessionExpired = isRecord(location.state) && location.state.sessionExpired === true

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = email.trim() !== '' && password.trim() !== '' && !submitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await loginUser({ email, password })

    setSubmitting(false)

    if (!result.ok) {
      setSession(null)
      setError(formatApiError(result))
      return
    }

    const decoded = decodeAccessToken(result.data.accessToken)

    writeSession({
      accessToken: result.data.accessToken,
      role: result.data.role,
      memberId: decoded?.memberId ?? null,
    })

    setSession({
      accessToken: result.data.accessToken,
      role: result.data.role,
      memberId: decoded?.memberId,
    })
  }

  return (
    <section className="page">
      <h2>Sign in</h2>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button type="submit" disabled={!canSubmit}>
          Log in
        </button>
      </form>
      {error !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {sessionExpired && (
        <p className="form-error session-expired" role="alert">
          Your session expired, please log in again
        </p>
      )}
      {session !== null && (
        <p className="status" role="status">
          Signed in as <strong className="status-role">{session.role}</strong>
          {session.memberId !== null && session.memberId !== undefined && (
            <span className="status-member"> (member id {session.memberId})</span>
          )}
        </p>
      )}
      <p className="form-hint">
        No account yet? <Link to="/register">Create an account</Link>
      </p>
    </section>
  )
}
