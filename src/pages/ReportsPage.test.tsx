import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/client'
import type { MostBorrowedRow, OverdueSummaryRow } from '../api/reports'
import { writeSession } from '../auth/session'
import { createFetchMock, jsonResponse } from '../test/http'
import type { FetchMock } from '../test/http'
import { ReportsPage } from './ReportsPage'

const mostBorrowedUrl = `${API_BASE_URL}/reports/most-borrowed`
const overdueSummaryUrl = `${API_BASE_URL}/reports/overdue-summary`

const dune: MostBorrowedRow = { bookId: 7, title: 'Dune', totalBorrows: 5 }
const emma: MostBorrowedRow = { bookId: 3, title: 'Emma', totalBorrows: 3 }

const ada: OverdueSummaryRow = { memberId: 42, name: 'Ada Lovelace', overdueCount: 2 }
const grace: OverdueSummaryRow = { memberId: 43, name: 'Grace Hopper', overdueCount: 1 }

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

function mockReports(
  mostBorrowedResponse: Response,
  overdueSummaryResponse: Response,
): FetchMock {
  const fetchMock = createFetchMock()

  fetchMock.mockImplementation((input) => {
    const url = urlOf(input)

    if (url === mostBorrowedUrl) {
      return Promise.resolve(mostBorrowedResponse)
    }

    if (url === overdueSummaryUrl) {
      return Promise.resolve(overdueSummaryResponse)
    }

    return Promise.resolve(jsonResponse(404, { error: 'Not found' }))
  })

  return fetchMock
}

function signIn(role: 'member' | 'librarian', memberId: number | null) {
  writeSession({ accessToken: 'test-access-token', role, memberId })
}

function bodyCells(table: HTMLElement): string[][] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent ?? ''))
}

describe('ReportsPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('renders both report tables in the order the endpoints returned them', async () => {
    const fetchMock = mockReports(
      jsonResponse(200, [dune, emma]),
      jsonResponse(200, [ada, grace]),
    )
    signIn('librarian', null)

    render(<ReportsPage />)

    expect(await screen.findByRole('heading', { name: 'Most borrowed' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Overdue summary' })).toBeInTheDocument()

    expect(bodyCells(screen.getByRole('table', { name: 'Most borrowed' }))).toEqual([
      ['Dune', '5'],
      ['Emma', '3'],
    ])
    expect(bodyCells(screen.getByRole('table', { name: 'Overdue summary' }))).toEqual([
      ['Ada Lovelace', '2'],
      ['Grace Hopper', '1'],
    ])

    expect(screen.queryByRole('alert')).toBeNull()

    const calledUrls = fetchMock.mock.calls.map(([input]) => urlOf(input))
    expect(calledUrls).toEqual([mostBorrowedUrl, overdueSummaryUrl])

    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toEqual({ Authorization: 'Bearer test-access-token' })
    }
  })

  it('renders both tables with a header row and no rows when the reports are empty', async () => {
    mockReports(jsonResponse(200, []), jsonResponse(200, []))
    signIn('librarian', null)

    render(<ReportsPage />)

    const mostBorrowedTable = await screen.findByRole('table', { name: 'Most borrowed' })
    const overdueSummaryTable = screen.getByRole('table', { name: 'Overdue summary' })

    expect(within(mostBorrowedTable).getAllByRole('row')).toHaveLength(1)
    expect(within(overdueSummaryTable).getAllByRole('row')).toHaveLength(1)
    expect(bodyCells(mostBorrowedTable)).toEqual([])
    expect(bodyCells(overdueSummaryTable)).toEqual([])
    expect(
      within(mostBorrowedTable).getByRole('columnheader', { name: 'Total borrows' }),
    ).toBeInTheDocument()
    expect(
      within(overdueSummaryTable).getByRole('columnheader', { name: 'Overdue count' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the service error and no rows when a report cannot be loaded', async () => {
    mockReports(jsonResponse(502, { error: 'Report upstream unavailable' }), jsonResponse(200, []))
    signIn('librarian', null)

    render(<ReportsPage />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Report upstream unavailable')
    expect(screen.queryByRole('table', { name: 'Most borrowed' })).toBeNull()
    expect(screen.queryByRole('table', { name: 'Overdue summary' })).toBeNull()
  })

  it('shows the librarian notice for a member and makes no report request', async () => {
    const fetchMock = createFetchMock()
    signIn('member', 42)

    render(<ReportsPage />)

    expect(await screen.findByText('Librarians only')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Most borrowed' })).toBeNull()
    expect(screen.queryByRole('table', { name: 'Overdue summary' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
