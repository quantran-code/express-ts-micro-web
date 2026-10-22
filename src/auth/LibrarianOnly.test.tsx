import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LibrarianOnly } from './LibrarianOnly'

describe('LibrarianOnly', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders its children for a librarian', () => {
    render(
      <LibrarianOnly role="librarian">
        <p>Add book form</p>
      </LibrarianOnly>,
    )

    expect(screen.getByText('Add book form')).toBeInTheDocument()
    expect(screen.queryByText('Librarians only')).toBeNull()
  })

  it('replaces its children with the notice for a member', () => {
    render(
      <LibrarianOnly role="member">
        <p>Add book form</p>
      </LibrarianOnly>,
    )

    expect(screen.getByText('Librarians only')).toBeInTheDocument()
    expect(screen.queryByText('Add book form')).toBeNull()
  })

  it('treats a missing role as not a librarian', () => {
    render(
      <LibrarianOnly role={null}>
        <p>Add book form</p>
      </LibrarianOnly>,
    )

    expect(screen.getByText('Librarians only')).toBeInTheDocument()
    expect(screen.queryByText('Add book form')).toBeNull()
  })
})
