import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { deleteMember, listMembers } from '../api/members'
import type { Member } from '../api/members'
import { LibrarianOnly } from '../auth/LibrarianOnly'
import { useSession } from '../auth/session'

export type MemberRowErrors = Record<number, string>

export function MembersPage(): ReactElement {
  const session = useSession()
  const accessToken = session?.accessToken ?? null
  const role = session?.role ?? null
  const isLibrarian = role === 'librarian'

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(isLibrarian && accessToken !== null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<MemberRowErrors>({})
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (accessToken === null || !isLibrarian) {
      return
    }

    const token = accessToken
    let cancelled = false

    setLoading(true)
    setLoadError(null)

    async function load() {
      const result = await listMembers(token)

      if (cancelled) {
        return
      }

      setLoading(false)

      if (!result.ok) {
        setMembers([])
        setLoadError(result.error)
        return
      }

      setMembers(result.data)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [accessToken, isLibrarian])

  async function handleDelete(memberId: number) {
    if (accessToken === null || deletingId !== null) {
      return
    }

    setDeletingId(memberId)
    setRowErrors((previous) => {
      const next = { ...previous }
      delete next[memberId]
      return next
    })

    const result = await deleteMember(accessToken, memberId)

    setDeletingId(null)

    if (!result.ok) {
      setRowErrors((previous) => ({ ...previous, [memberId]: result.error }))
      return
    }

    setMembers((previous) => previous.filter((member) => member.id !== memberId))
  }

  return (
    <section className="page">
      <h2>Members</h2>
      {accessToken === null && (
        <p className="form-error" role="alert">
          Sign in to manage members
        </p>
      )}
      <LibrarianOnly role={role}>
        {loading && <p className="catalog-status">Loading members…</p>}
        {loadError !== null && (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        )}
        {!loading && loadError === null && members.length === 0 && (
          <p className="catalog-empty">No members found.</p>
        )}
        <ul className="book-list member-list">
          {members.map((member) => {
            const rowError: string | undefined = rowErrors[member.id]

            return (
              <li className="book-row member-row" key={member.id}>
                <div className="book-title member-name">{member.name}</div>
                <div className="book-meta member-email">{member.email}</div>
                <button
                  type="button"
                  className="delete-button"
                  disabled={deletingId !== null}
                  onClick={() => {
                    void handleDelete(member.id)
                  }}
                >
                  Delete
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
      </LibrarianOnly>
    </section>
  )
}
