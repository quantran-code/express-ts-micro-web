import type { ApiResult } from './client'
import { isLoan } from './loans'
import type { Loan } from './loans'
import { isRecord, requestJson, requestVoid } from './request'

export interface Member {
  id: number
  name: string
  email: string
}

export interface UpdateMemberBody {
  name?: string
  email?: string
}

function isMember(value: unknown): value is Member {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string'
  )
}

function isMemberArray(value: unknown): value is Member[] {
  return Array.isArray(value) && value.every((item) => isMember(item))
}

function isLoanArray(value: unknown): value is Loan[] {
  return Array.isArray(value) && value.every((item) => isLoan(item))
}

export function getMember(accessToken: string, memberId: number): Promise<ApiResult<Member>> {
  return requestJson(`/members/${memberId}`, { method: 'GET', accessToken }, isMember)
}

export function updateMember(
  accessToken: string,
  memberId: number,
  body: UpdateMemberBody,
): Promise<ApiResult<Member>> {
  return requestJson(`/members/${memberId}`, { method: 'PATCH', accessToken, body }, isMember)
}

export function listMembers(accessToken: string): Promise<ApiResult<Member[]>> {
  return requestJson('/members', { method: 'GET', accessToken }, isMemberArray)
}

export function deleteMember(accessToken: string, memberId: number): Promise<ApiResult<null>> {
  return requestVoid(`/members/${memberId}`, { method: 'DELETE', accessToken })
}

export function listMemberLoans(accessToken: string, memberId: number): Promise<ApiResult<Loan[]>> {
  return requestJson(`/members/${memberId}/loans`, { method: 'GET', accessToken }, isLoanArray)
}
