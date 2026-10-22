import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/client'
import type { Book } from '../api/catalog'
import { writeSession } from '../auth/session'
import {
  createFetchMock,
  firstFetchCall,
  jsonResponse,
  readJsonBody,
} from '../test/http'
import type { FetchCall, FetchMock } from '../test/http'
import { BookCatalogPage } from './BookCatalogPage'

const dune: Book = {
  id: 7,
  title: 'Dune',
  author: 'Frank Herbert',
  isbn: '9780441013593',
  totalCopies: 2,
  availableCopies: 1,
}

const emma: Book = {
  id: 9,
  title: 'Emma',
  author: 'Jane Austen',
  isbn: '9780141439587',
  totalCopies: 1,
  availableCopies: 1,
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

function fetchCallAt(fetchMock: FetchMock, index: number): FetchCall {
  const call = fetchMock.mock.calls[index]

  if (call === undefined || call[1] === undefined) {
    throw new Error(`fetch call ${index} was not made`)
  }

  return { url: urlOf(call[0]), init: call[1] }
}

function renderCatalogPage() {
  render(
    <MemoryRouter initialEntries={['/books']}>
      <BookCatalogPage />
    </MemoryRouter>,
  )
}

function signIn(role: 'member' | 'librarian', memberId: number | null) {
  writeSession({ accessToken: 'test-access-token', role, memberId })
}

function fillAddBookForm(values: { title: string; author: string; isbn: string; totalCopies: string }) {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: values.title } })
  fireEvent.change(screen.getByLabelText('Author'), { target: { value: values.author } })
  fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: values.isbn } })
  fireEvent.change(screen.getByLabelText('Total copies'), { target: { value: values.totalCopies } })
}

describe('BookCatalogPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('lists the catalog with the bearer token from the stored session', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, [dune]))
    signIn('member', 42)

    renderCatalogPage()

    expect(await screen.findByText('Dune')).toBeInTheDocument()
    expect(screen.getByText(/Frank Herbert/)).toBeInTheDocument()
    expect(screen.getByText(/9780441013593/)).toBeInTheDocument()
    expect(screen.getByText(/1 of 2 available/)).toBeInTheDocument()

    const call = firstFetchCall(fetchMock)
    expect(call.url).toBe(`${API_BASE_URL}/books`)
    expect(call.init.method).toBe('GET')
    expect(call.init.headers).toEqual({ Authorization: 'Bearer test-access-token' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('searches on change and shows the full list again when the query is cleared', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).includes('/books/search')) {
        return Promise.resolve(jsonResponse(200, { data: [emma], total: 1 }))
      }

      return Promise.resolve(jsonResponse(200, [dune, emma]))
    })
    signIn('member', 42)

    renderCatalogPage()

    expect(await screen.findByText('Dune')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search books'), { target: { value: 'emm' } })

    expect(await screen.findByText('Emma')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('Dune')).toBeNull()
    })

    const searchCall = fetchCallAt(fetchMock, 1)
    expect(searchCall.url).toBe(`${API_BASE_URL}/books/search?q=emm`)

    fireEvent.change(screen.getByLabelText('Search books'), { target: { value: '' } })

    expect(await screen.findByText('Dune')).toBeInTheDocument()
    expect(screen.getByText('Emma')).toBeInTheDocument()
  })

  it('renders an empty state when the search matches nothing', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).includes('/books/search')) {
        return Promise.resolve(jsonResponse(200, { data: [], total: 0 }))
      }

      return Promise.resolve(jsonResponse(200, [dune]))
    })
    signIn('member', 42)

    renderCatalogPage()

    expect(await screen.findByText('Dune')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search books'), { target: { value: 'zzz' } })

    expect(await screen.findByText('No books found.')).toBeInTheDocument()
    expect(screen.queryByText('Dune')).toBeNull()
  })

  it('borrows a book and refreshes the availability on success', async () => {
    const fetchMock = createFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [dune]))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          id: 1,
          bookId: 7,
          memberId: 42,
          borrowedAt: '2026-01-01T00:00:00.000Z',
          returnedAt: null,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, [{ ...dune, availableCopies: 0 }]))
    signIn('member', 42)

    renderCatalogPage()

    const borrow = await screen.findByRole('button', { name: 'Borrow' })
    expect(borrow).toBeEnabled()

    fireEvent.click(borrow)

    expect(await screen.findByText(/0 of 2 available/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrow' })).toBeDisabled()

    const borrowCall = fetchCallAt(fetchMock, 1)
    expect(borrowCall.url).toBe(`${API_BASE_URL}/loans`)
    expect(borrowCall.init.method).toBe('POST')
    expect(borrowCall.init.headers).toEqual({
      Authorization: 'Bearer test-access-token',
      'Content-Type': 'application/json',
    })
    expect(readJsonBody(borrowCall.init)).toEqual({ bookId: 7 })
  })

  it('disables the borrow button when no copies are available', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, [{ ...dune, availableCopies: 0 }]))
    signIn('member', 42)

    renderCatalogPage()

    expect(await screen.findByRole('button', { name: 'Borrow' })).toBeDisabled()
  })

  it('renders the exact 409 message next to the row when a borrow is refused', async () => {
    const fetchMock = createFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [dune]))
      .mockResolvedValueOnce(
        jsonResponse(409, { error: 'This member already has an active loan for this book' }),
      )
    signIn('member', 42)

    renderCatalogPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Borrow' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('This member already has an active loan for this book')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('adds a book as a librarian and refetches the list with the current query', async () => {
    const fetchMock = createFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [dune]))
      .mockResolvedValueOnce(jsonResponse(201, emma))
      .mockResolvedValueOnce(jsonResponse(200, [dune, emma]))
    signIn('librarian', null)

    renderCatalogPage()

    expect(await screen.findByText('Dune')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrow' })).toBeNull()

    fillAddBookForm({
      title: 'Emma',
      author: 'Jane Austen',
      isbn: '9780141439587',
      totalCopies: '1',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add book' }))

    expect(await screen.findByText('Emma')).toBeInTheDocument()

    const createCall = fetchCallAt(fetchMock, 1)
    expect(createCall.url).toBe(`${API_BASE_URL}/books`)
    expect(createCall.init.method).toBe('POST')
    expect(createCall.init.headers).toEqual({
      Authorization: 'Bearer test-access-token',
      'Content-Type': 'application/json',
    })
    expect(readJsonBody(createCall.init)).toEqual({
      title: 'Emma',
      author: 'Jane Austen',
      isbn: '9780141439587',
      totalCopies: 1,
    })

    const refetchCall = fetchCallAt(fetchMock, 2)
    expect(refetchCall.url).toBe(`${API_BASE_URL}/books`)
  })

  it('renders the exact 409 message when the ISBN already exists', async () => {
    const fetchMock = createFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [dune]))
      .mockResolvedValueOnce(jsonResponse(409, { error: 'ISBN already exists' }))
    signIn('librarian', null)

    renderCatalogPage()

    expect(await screen.findByText('Dune')).toBeInTheDocument()

    fillAddBookForm({
      title: 'Dune',
      author: 'Frank Herbert',
      isbn: '9780441013593',
      totalCopies: '2',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add book' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('ISBN already exists')
  })

  it('shows the librarian notice instead of the add-book form for a member', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(200, [dune]))
    signIn('member', 42)

    renderCatalogPage()

    expect(await screen.findByText('Dune')).toBeInTheDocument()
    expect(screen.getByText('Librarians only')).toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).toBeNull()
  })
})
