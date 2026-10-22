import { useEffect, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { getMember, listMemberLoans, updateMember } from '../api/members'
import type { Member } from '../api/members'
import { returnLoan } from '../api/loans'
import type { Loan } from '../api/loans'
import { useSession } from '../auth/session'

export type LoanRowErrors = Record<number, string>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INVALID_EMAIL_MESSAGE = 'Enter a valid email address'

export function ProfilePage(): ReactElement {
  const session = useSession()
  const accessToken = session?.accessToken ?? null
  const memberId = typeof session?.memberId === 'number' ? session.memberId : null
  const hasProfile = accessToken !== null && memberId !== null

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(hasProfile)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loans, setLoans] = useState<Loan[]>([])
  const [loansLoading, setLoansLoading] = useState(hasProfile)
  const [loansError, setLoansError] = useState<string | null>(null)
  const [loanErrors, setLoanErrors] = useState<LoanRowErrors>({})
  const [returningId, setReturningId] = useState<number | null>(null)

  useEffect(() => {
    if (accessToken === null || memberId === null) {
      return
    }

    const token = accessToken
    const id = memberId
    let cancelled = false

    setLoading(true)
    setLoadError(null)

    async function load() {
      const result = await getMember(token, id)

      if (cancelled) {
        return
      }

      setLoading(false)

      if (!result.ok) {
        setMember(null)
        setLoadError(result.error)
        return
      }

      setMember(result.data)
      setName(result.data.name)
      setEmail(result.data.email)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [accessToken, memberId])

  useEffect(() => {
    if (accessToken === null || memberId === null) {
      return
    }

    const token = accessToken
    const id = memberId
    let cancelled = false

    setLoansLoading(true)
    setLoansError(null)

    async function load() {
      const result = await listMemberLoans(token, id)

      if (cancelled) {
        return
      }

      setLoansLoading(false)

      if (!result.ok) {
        setLoans([])
        setLoansError(result.error)
        return
      }

      setLoans(result.data)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [accessToken, memberId])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (accessToken === null || memberId === null || saving) {
      return
    }

    const trimmedEmail = email.trim()

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setSaveError(INVALID_EMAIL_MESSAGE)
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await updateMember(accessToken, memberId, {
      name: name.trim(),
      email: trimmedEmail,
    })

    setSaving(false)

    if (!result.ok) {
      setSaveError(result.error)
      return
    }

    setMember(result.data)
    setName(result.data.name)
    setEmail(result.data.email)
  }

  async function handleReturn(loanId: number) {
    if (accessToken === null || returningId !== null) {
      return
    }

    setReturningId(loanId)
    setLoanErrors((previous) => {
      const next = { ...previous }
      delete next[loanId]
      return next
    })

    const result = await returnLoan(accessToken, loanId)

    setReturningId(null)

    if (!result.ok) {
      setLoanErrors((previous) => ({ ...previous, [loanId]: result.error }))
      return
    }

    setLoans((previous) => previous.filter((loan) => loan.id !== loanId))
  }

  return (
    <section className="page">
      <h2 className="profile-heading">My profile</h2>
      {accessToken === null && (
        <p className="form-error" role="alert">
          Sign in to see your profile
        </p>
      )}
      {session !== null && memberId === null && (
        <p className="guard-message">No member profile for this account</p>
      )}
      {hasProfile && loading && <p className="catalog-status">Loading profile…</p>}
      {loadError !== null && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}
      {member !== null && (
        <div className="profile-section">
          <h3>Profile</h3>
          <div className="profile-row">
            <span className="profile-label">Name</span>
            <span className="profile-value profile-name">{member.name}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Email</span>
            <span className="profile-value profile-email">{member.email}</span>
          </div>
        </div>
      )}
      {member !== null && (
        <form className="form profile-form" onSubmit={handleSave} noValidate>
          <div className="field">
            <label htmlFor="profile-name">Edit name</label>
            <input
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="profile-email">Edit email</label>
            <input
              id="profile-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <button type="submit" className="profile-save" disabled={saving}>
            Save changes
          </button>
        </form>
      )}
      {saveError !== null && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      {memberId !== null && (
        <div className="profile-section my-loans">
          <h3>My loans</h3>
          {loansLoading && <p className="catalog-status">Loading loans…</p>}
          {loansError !== null && (
            <p className="form-error" role="alert">
              {loansError}
            </p>
          )}
          {!loansLoading && loansError === null && loans.length === 0 && (
            <p className="catalog-empty">No active loans.</p>
          )}
          <ul className="loans-list">
            {loans.map((loan) => {
              const rowError: string | undefined = loanErrors[loan.id]

              return (
                <li className="loan-row" key={loan.id}>
                  <div className="book-title">Book {loan.bookId}</div>
                  <div className="book-meta loan-borrowed">Borrowed {loan.borrowedAt}</div>
                  <button
                    type="button"
                    className="return-button"
                    disabled={returningId !== null}
                    onClick={() => {
                      void handleReturn(loan.id)
                    }}
                  >
                    Return
                  </button>
                  {rowError !== undefined && (
                    <p className="row-error" role="alert">
                      {rowError}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
