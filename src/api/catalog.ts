import type { ApiResult } from './client'
import { isRecord, requestJson } from './request'

export interface Book {
  id: number
  title: string
  author: string
  isbn: string
  totalCopies: number
  availableCopies: number
}

export interface BookSearchResult {
  data: Book[]
  total: number
}

export interface CreateBookInput {
  title: string
  author: string
  isbn: string
  totalCopies: number
}

function isBook(value: unknown): value is Book {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.author === 'string' &&
    typeof value.isbn === 'string' &&
    typeof value.totalCopies === 'number' &&
    typeof value.availableCopies === 'number'
  )
}

function isBookArray(value: unknown): value is Book[] {
  return Array.isArray(value) && value.every((item) => isBook(item))
}

function isBookSearchResult(value: unknown): value is BookSearchResult {
  return isRecord(value) && isBookArray(value.data) && typeof value.total === 'number'
}

export function listBooks(accessToken: string): Promise<ApiResult<Book[]>> {
  return requestJson('/books', { method: 'GET', accessToken }, isBookArray)
}

export function searchBooks(
  accessToken: string,
  query: string,
): Promise<ApiResult<BookSearchResult>> {
  return requestJson(
    `/books/search?q=${encodeURIComponent(query)}`,
    { method: 'GET', accessToken },
    isBookSearchResult,
  )
}

export function createBook(accessToken: string, input: CreateBookInput): Promise<ApiResult<Book>> {
  return requestJson('/books', { method: 'POST', accessToken, body: input }, isBook)
}
