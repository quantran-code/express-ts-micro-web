import type { ApiResult } from './client'
import { isRecord, requestJson } from './client'

export interface MostBorrowedRow {
  bookId: number
  title: string
  totalBorrows: number
}

export interface OverdueSummaryRow {
  memberId: number
  name: string
  overdueCount: number
}

function isMostBorrowedRow(value: unknown): value is MostBorrowedRow {
  return (
    isRecord(value) &&
    typeof value.bookId === 'number' &&
    typeof value.title === 'string' &&
    typeof value.totalBorrows === 'number'
  )
}

function isOverdueSummaryRow(value: unknown): value is OverdueSummaryRow {
  return (
    isRecord(value) &&
    typeof value.memberId === 'number' &&
    typeof value.name === 'string' &&
    typeof value.overdueCount === 'number'
  )
}

export function isMostBorrowedRowArray(value: unknown): value is MostBorrowedRow[] {
  return Array.isArray(value) && value.every((item) => isMostBorrowedRow(item))
}

export function isOverdueSummaryRowArray(value: unknown): value is OverdueSummaryRow[] {
  return Array.isArray(value) && value.every((item) => isOverdueSummaryRow(item))
}

export function fetchMostBorrowed(accessToken: string): Promise<ApiResult<MostBorrowedRow[]>> {
  return requestJson(
    '/reports/most-borrowed',
    { method: 'GET', accessToken },
    isMostBorrowedRowArray,
  )
}

export function fetchOverdueSummary(
  accessToken: string,
): Promise<ApiResult<OverdueSummaryRow[]>> {
  return requestJson(
    '/reports/overdue-summary',
    { method: 'GET', accessToken },
    isOverdueSummaryRowArray,
  )
}
