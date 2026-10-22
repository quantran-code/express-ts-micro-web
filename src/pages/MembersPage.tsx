import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { deactivateMember, deleteMember, listMembers } from '../api/members'
import type { Member } from '../api/members'
import { formatPageError } from '../api/client'
import { LibrarianOnly } from '../auth/LibrarianOnly'
import { useSession } from '../auth/session'
import { decodeAccessToken } from '../auth/token'

export type MemberRowErrors = Record<number, string>

export function MembersPage(): ReactElement {
  const session = useSession()
  const accessToken = session?.accessToken ?? null
  const role = session?.role ?? null
  const isLibrarian = role === 'librarian'
  const viewerRole = accessToken === null ? undefined : decodeAccessToken(accessToken)?.role

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(isLibrarian && accessToken !== null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<MemberRowErrors>({})
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)

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
        setLoadError(formatPageError(result))
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
      const message = formatPageError(result)

      if (message !== null) {
        setRowErrors((previous) => ({ ...previous, [memberId]: message }))
      }

      return
    }

    setMembers((previous) => previous.filter((member) => member.id !== memberId))
  }

  async function handleDeactivate(memberId: number) {
    if (accessToken === null || deactivatingId !== null) {
      return
    }

    setDeactivatingId(memberId)
    setRowErrors((previous) => {
      const next = { ...previous }
      delete next[memberId]
      return next
    })

    const result = await deactivateMember(accessToken, memberId)

    setDeactivatingId(null)

    if (!result.ok) {
      const message = formatPageError(result)

      if (message !== null) {
        setRowErrors((previous) => ({ ...previous, [memberId]: message }))
      }

      return
    }

    setMembers((previous) =>
      previous.map((member) => (member.id === memberId ? { ...member, active: false } : member)),
    )
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
                {member.active === false && <span className="inactive-badge">Inactive</span>}
                {viewerRole === 'librarian' && member.active !== false && (
                  <button
                    type="button"
                    className="deactivate-button"
                    disabled={deactivatingId !== null}
                    onClick={() => {
                      void handleDeactivate(member.id)
                    }}
                  >
                    Deactivate
                  </button>
                )}
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
