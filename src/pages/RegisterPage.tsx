import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatApiError, registerUser } from '../api/client'
import type { AuthRole, RegisterResponse } from '../api/client'

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AuthRole>('member')
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState<RegisterResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit =
    name.trim() !== '' && email.trim() !== '' && password.trim() !== '' && !submitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await registerUser({ name, email, password, role })

    setSubmitting(false)

    if (!result.ok) {
      setRegistered(null)
      setError(formatApiError(result))
      return
    }

    setRegistered(result.data)
  }

  return (
    <section className="page">
      <h2>Create an account</h2>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="register-name">Name</label>
          <input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="register-role">Role</label>
          <select
            id="register-role"
            name="role"
            className="role-select"
            value={role}
            onChange={(event) =>
              setRole(event.target.value === 'librarian' ? 'librarian' : 'member')
            }
          >
            <option value="member">member</option>
            <option value="librarian">librarian</option>
          </select>
        </div>
        <button type="submit" disabled={!canSubmit}>
          Register
        </button>
      </form>
      {error !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {registered !== null && (
        <p className="status" role="status">
          Registered member id {registered.id}, <strong className="status-email">{registered.email}</strong>,
          as <strong className="status-role">{registered.role}</strong>
        </p>
      )}
      <p className="form-hint">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </section>
  )
}
