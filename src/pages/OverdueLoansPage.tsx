import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { listOverdueLoans } from '../api/loans'
import type { OverdueLoan } from '../api/loans'
import { LibrarianOnly } from '../auth/LibrarianOnly'
import { useSession } from '../auth/session'

export function OverdueLoansPage(): ReactElement {
  const session = useSession()
  const accessToken = session?.accessToken ?? null
  const role = session?.role ?? null
  const isLibrarian = role === 'librarian'

  const [loans, setLoans] = useState<OverdueLoan[]>([])
  const [loading, setLoading] = useState(isLibrarian && accessToken !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (accessToken === null || !isLibrarian) {
      return
    }

    const token = accessToken
    let cancelled = false

    setLoading(true)
    setError(null)

    async function load() {
      const result = await listOverdueLoans(token)

      if (cancelled) {
        return
      }

      setLoading(false)

      if (!result.ok) {
        setLoans([])
        setError(result.error)
        return
      }

      setLoans(result.data)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [accessToken, isLibrarian])

  return (
    <section className="page">
      <h2>Overdue loans</h2>
      {accessToken === null && (
        <p className="form-error" role="alert">
          Sign in to see the overdue loans
        </p>
      )}
      <LibrarianOnly role={role}>
        {loading && <p className="catalog-status">Loading overdue loans…</p>}
        {error !== null && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!loading && error === null && loans.length === 0 && (
          <p className="catalog-empty">No overdue loans.</p>
        )}
        <ul className="book-list overdue-list">
          {loans.map((loan) => (
            <li className="book-row overdue-row" key={loan.id}>
              <div className="book-title">Book {loan.bookId}</div>
              <div className="book-meta">Member {loan.memberId}</div>
              <div className="book-meta overdue-due">Due {loan.dueDate}</div>
            </li>
          ))}
        </ul>
      </LibrarianOnly>
    </section>
  )
}
