import type { ApiResult } from './client'
import { isRecord, requestJson } from './client'

export interface Loan {
  id: number
  bookId: number
  memberId: number
  borrowedAt: string
  returnedAt: string | null
}

export interface OverdueLoan extends Loan {
  dueDate: string
}

export function isLoan(value: unknown): value is Loan {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.bookId === 'number' &&
    typeof value.memberId === 'number' &&
    typeof value.borrowedAt === 'string' &&
    (value.returnedAt === null || typeof value.returnedAt === 'string')
  )
}

function isOverdueLoan(value: unknown): value is OverdueLoan {
  if (!isRecord(value) || !isLoan(value)) {
    return false
  }

  return typeof value.dueDate === 'string'
}

function isOverdueLoanArray(value: unknown): value is OverdueLoan[] {
  return Array.isArray(value) && value.every((item) => isOverdueLoan(item))
}

export function borrowBook(
  accessToken: string,
  body: { bookId: number },
): Promise<ApiResult<Loan>> {
  return requestJson('/loans', { method: 'POST', accessToken, body }, isLoan)
}

export function returnLoan(accessToken: string, loanId: number): Promise<ApiResult<Loan>> {
  return requestJson(`/loans/${loanId}/return`, { method: 'POST', accessToken }, isLoan)
}

export function listOverdueLoans(accessToken: string): Promise<ApiResult<OverdueLoan[]>> {
  return requestJson('/loans/overdue', { method: 'GET', accessToken }, isOverdueLoanArray)
}
