import { useEffect, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { createBook, listBooks, searchBooks } from '../api/catalog'
import type { Book } from '../api/catalog'
import { borrowBook } from '../api/loans'
import { LibrarianOnly } from '../auth/LibrarianOnly'
import { useSession } from '../auth/session'

export type BookRowErrors = Record<number, string>

export function BookCatalogPage(): ReactElement {
  const session = useSession()
  const accessToken = session?.accessToken ?? null
  const role = session?.role ?? null

  const [books, setBooks] = useState<Book[]>([])
  const [query, setQuery] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [loading, setLoading] = useState(accessToken !== null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<BookRowErrors>({})
  const [borrowingId, setBorrowingId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [totalCopies, setTotalCopies] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const canAddBook =
    title.trim() !== '' &&
    author.trim() !== '' &&
    isbn.trim() !== '' &&
    totalCopies.trim() !== '' &&
    !adding

  useEffect(() => {
    if (accessToken === null) {
      return
    }

    const token = accessToken
    const activeQuery = query.trim()
    let cancelled = false

    setLoading(true)
    setLoadError(null)

    async function load() {
      if (activeQuery === '') {
        const allBooks = await listBooks(token)

        if (cancelled) {
          return
        }

        setLoading(false)

        if (!allBooks.ok) {
          setBooks([])
          setLoadError(allBooks.error)
          return
        }

        setBooks(allBooks.data)
        return
      }

      const matches = await searchBooks(token, activeQuery)

      if (cancelled) {
        return
      }

      setLoading(false)

      if (!matches.ok) {
        setBooks([])
        setLoadError(matches.error)
        return
      }

      setBooks(matches.data.data)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [accessToken, query, reloadToken])

  async function handleBorrow(book: Book) {
    if (accessToken === null || borrowingId !== null) {
      return
    }

    setBorrowingId(book.id)
    setRowErrors((previous) => {
      const next = { ...previous }
      delete next[book.id]
      return next
    })

    const result = await borrowBook(accessToken, { bookId: book.id })

    setBorrowingId(null)

    if (!result.ok) {
      setRowErrors((previous) => ({ ...previous, [book.id]: result.error }))
      return
    }

    setReloadToken((token) => token + 1)
  }

  async function handleAddBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (accessToken === null || !canAddBook) {
      return
    }

    const copies = Number(totalCopies)

    if (!Number.isInteger(copies) || copies < 1) {
      setAddError('Total copies must be a positive whole number')
      return
    }

    setAdding(true)
    setAddError(null)

    const result = await createBook(accessToken, {
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim(),
      totalCopies: copies,
    })

    setAdding(false)

    if (!result.ok) {
      setAddError(result.error)
      return
    }

    setTitle('')
    setAuthor('')
    setIsbn('')
    setTotalCopies('')
    setReloadToken((token) => token + 1)
  }

  return (
    <section className="page">
      <h2>Book catalog</h2>
      {accessToken === null && (
        <p className="form-error" role="alert">
          Sign in to browse the catalog
        </p>
      )}
      <div className="field catalog-search">
        <label htmlFor="catalog-search">Search books</label>
        <input
          id="catalog-search"
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {loading && <p className="catalog-status">Loading books…</p>}
      {loadError !== null && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}
      {!loading && loadError === null && books.length === 0 && (
        <p className="catalog-empty">No books found.</p>
      )}
      <ul className="book-list">
        {books.map((book) => {
          const rowError: string | undefined = rowErrors[book.id]

          return (
            <li className="book-row" key={book.id}>
              <div className="book-title">{book.title}</div>
              <div className="book-meta">
                {book.author} · ISBN {book.isbn} · {book.availableCopies} of {book.totalCopies}{' '}
                available
              </div>
              {role === 'member' && (
                <button
                  type="button"
                  className="borrow-button"
                  disabled={book.availableCopies === 0 || borrowingId !== null}
                  onClick={() => {
                    void handleBorrow(book)
                  }}
                >
                  Borrow
                </button>
              )}
              {rowError !== undefined && (
                <p className="row-error" role="alert">
                  {rowError}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      <LibrarianOnly role={role}>
        <form className="form add-book" onSubmit={handleAddBook} noValidate>
          <h3>Add book</h3>
          <div className="field">
            <label htmlFor="add-book-title">Title</label>
            <input
              id="add-book-title"
              name="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="add-book-author">Author</label>
            <input
              id="add-book-author"
              name="author"
              type="text"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="add-book-isbn">ISBN</label>
            <input
              id="add-book-isbn"
              name="isbn"
              type="text"
              value={isbn}
              onChange={(event) => setIsbn(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="add-book-total-copies">Total copies</label>
            <input
              id="add-book-total-copies"
              name="totalCopies"
              type="number"
              min="1"
              step="1"
              value={totalCopies}
              onChange={(event) => setTotalCopies(event.target.value)}
            />
          </div>
          <button type="submit" disabled={!canAddBook}>
            Add book
          </button>
          {addError !== null && (
            <p className="row-error" role="alert">
              {addError}
            </p>
          )}
        </form>
      </LibrarianOnly>
    </section>
  )
}
