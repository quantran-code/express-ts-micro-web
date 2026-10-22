import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/client'
import { createFetchMock, firstFetchCall, jsonResponse, readJsonBody } from '../test/http'
import { RegisterPage } from './RegisterPage'

function renderRegisterPage() {
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  )
}

function fillRegisterForm(name: string, email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

async function submitAndReadError(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: 'Register' }))

  return screen.findByRole('alert')
}

describe('RegisterPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('defaults the role selector to member and offers librarian as the only other option', () => {
    createFetchMock()
    renderRegisterPage()

    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('member')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'member',
      'librarian',
    ])
  })

  it('disables the submit button until name, email and password are filled', () => {
    const fetchMock = createFetchMock()
    renderRegisterPage()

    const submit = screen.getByRole('button', { name: 'Register' })
    expect(submit).toBeDisabled()

    fillRegisterForm('Ada', 'ada@library.test', '')
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } })
    expect(submit).toBeEnabled()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not call fetch when the form is submitted with a required field left empty', () => {
    const fetchMock = createFetchMock()
    renderRegisterPage()

    fillRegisterForm('Ada', '', 'Password123!')

    const form = screen.getByRole('button', { name: 'Register' }).closest('form')

    if (form === null) {
      throw new Error('register form was not rendered')
    }

    fireEvent.submit(form)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders the registered member id, email and role on success', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse(201, {
        id: 12,
        memberId: 3,
        name: 'Ada',
        email: 'ada@library.test',
        role: 'member',
      }),
    )

    renderRegisterPage()
    fillRegisterForm('Ada', 'Ada@Library.test', 'Password123!')
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('12')
    expect(status).toHaveTextContent('ada@library.test')
    expect(status).toHaveTextContent('member')
    expect(screen.queryByRole('alert')).toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const call = firstFetchCall(fetchMock)
    expect(call.url).toBe(`${API_BASE_URL}/auth/register`)
    expect(call.init.method).toBe('POST')
    expect(call.init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(call.init.headers).not.toHaveProperty('x-service-key')
    expect(readJsonBody(call.init)).toEqual({
      name: 'Ada',
      email: 'Ada@Library.test',
      password: 'Password123!',
      role: 'member',
    })
  })

  it('renders the exact error string for a 400 validation failure', async () => {
    const fetchMock = createFetchMock()
    const message = 'Password must be at least 8 characters'
    fetchMock.mockResolvedValue(jsonResponse(400, { error: message }))

    renderRegisterPage()
    fillRegisterForm('Ada', 'ada@library.test', 'short')
    expect(await submitAndReadError()).toHaveTextContent(message)
  })

  it('renders the exact error string for a 403 librarian escalation attempt', async () => {
    const fetchMock = createFetchMock()
    const message = 'Only a librarian can create a librarian account'
    fetchMock.mockResolvedValue(jsonResponse(403, { error: message }))

    renderRegisterPage()
    fillRegisterForm('Ada', 'ada@library.test', 'Password123!')
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: 'librarian' },
    })

    const alert = await submitAndReadError()
    expect(alert.textContent).toBe(message)
    expect(readJsonBody(firstFetchCall(fetchMock).init)).toEqual({
      name: 'Ada',
      email: 'ada@library.test',
      password: 'Password123!',
      role: 'librarian',
    })
  })

  it('renders the exact error string for a 409 duplicate email', async () => {
    const fetchMock = createFetchMock()
    const message = 'Email already registered'
    fetchMock.mockResolvedValue(jsonResponse(409, { error: message }))

    renderRegisterPage()
    fillRegisterForm('Ada', 'ada@library.test', 'Password123!')

    const alert = await submitAndReadError()
    expect(alert.textContent).toBe(message)
  })

  it('renders the exact error string for a 502 unreachable member-service', async () => {
    const fetchMock = createFetchMock()
    const message = 'Unable to reach member-service'
    fetchMock.mockResolvedValue(jsonResponse(502, { error: message }))

    renderRegisterPage()
    fillRegisterForm('Ada', 'ada@library.test', 'Password123!')

    const alert = await submitAndReadError()
    expect(alert.textContent).toBe(message)
  })
})
