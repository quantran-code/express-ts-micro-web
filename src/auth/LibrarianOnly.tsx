import type { ReactElement, ReactNode } from 'react'
import type { AuthRole } from '../api/client'

export interface LibrarianOnlyProps {
  role: AuthRole | null
  children: ReactNode
}

/**
 * Renders its children only for librarians; everyone else sees a visible notice
 * in their place. This is a rendering guard only, not a route-level redirect.
 */
export function LibrarianOnly({ role, children }: LibrarianOnlyProps): ReactElement {
  if (role !== 'librarian') {
    return <p className="guard-message">Librarians only</p>
  }

  return <>{children}</>
}
