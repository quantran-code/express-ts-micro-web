import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { fetchMostBorrowed, fetchOverdueSummary } from '../api/reports'
import type { MostBorrowedRow, OverdueSummaryRow } from '../api/reports'
import { formatPageError } from '../api/client'
import { LibrarianOnly } from '../auth/LibrarianOnly'
import { useSession } from '../auth/session'

export function ReportsPage(): ReactElement {
  const session = useSession()
  const accessToken = session?.accessToken ?? null
  const role = session?.role ?? null
  const isLibrarian = role === 'librarian'

  const [mostBorrowed, setMostBorrowed] = useState<MostBorrowedRow[]>([])
  const [overdueSummary, setOverdueSummary] = useState<OverdueSummaryRow[]>([])
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
      const mostBorrowedResult = await fetchMostBorrowed(token)
      const overdueSummaryResult = await fetchOverdueSummary(token)

      if (cancelled) {
        return
      }

      setLoading(false)

      if (!mostBorrowedResult.ok) {
        setMostBorrowed([])
        setOverdueSummary([])
        setError(formatPageError(mostBorrowedResult))
        return
      }

      if (!overdueSummaryResult.ok) {
        setMostBorrowed([])
        setOverdueSummary([])
        setError(formatPageError(overdueSummaryResult))
        return
      }

      setMostBorrowed(mostBorrowedResult.data)
      setOverdueSummary(overdueSummaryResult.data)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [accessToken, isLibrarian])

  return (
    <section className="page">
      <h2>Reports</h2>
      {accessToken === null && (
        <p className="form-error" role="alert">
          Sign in to see the reports
        </p>
      )}
      <LibrarianOnly role={role}>
        {loading && <p className="catalog-status">Loading reports…</p>}
        {error !== null && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {error === null && (
          <>
            <div className="profile-section report-section">
              <h3>Most borrowed</h3>
              <table className="report-table" aria-label="Most borrowed">
                <thead>
                  <tr>
                    <th scope="col">Title</th>
                    <th scope="col" className="report-count">
                      Total borrows
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mostBorrowed.map((row) => (
                    <tr className="report-row" key={row.bookId}>
                      <td>{row.title}</td>
                      <td className="report-count">{row.totalBorrows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="profile-section report-section">
              <h3>Overdue summary</h3>
              <table className="report-table" aria-label="Overdue summary">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col" className="report-count">
                      Overdue count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overdueSummary.map((row) => (
                    <tr className="report-row" key={row.memberId}>
                      <td>{row.name}</td>
                      <td className="report-count">{row.overdueCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </LibrarianOnly>
    </section>
  )
}
