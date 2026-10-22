import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/client'
import {
  createAccessToken,
  createFetchMock,
  firstFetchCall,
  jsonResponse,
  readJsonBody,
} from '../test/http'
import { LoginPage } from './LoginPage'

function renderLoginPage() {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

function fillLoginForm(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

describe('LoginPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('disables the submit button until both fields are filled', () => {
    const fetchMock = createFetchMock()
    renderLoginPage()

    const submit = screen.getByRole('button', { name: 'Log in' })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@library.test' } })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } })
    expect(submit).toBeEnabled()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not call fetch when the form is submitted with a required field left empty', () => {
    const fetchMock = createFetchMock()
    renderLoginPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@library.test' } })

    const form = screen.getByRole('button', { name: 'Log in' }).closest('form')

    if (form === null) {
      throw new Error('login form was not rendered')
    }

    fireEvent.submit(form)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('posts the documented body and shows the role and decoded memberId on success', async () => {
    const fetchMock = createFetchMock()
    const accessToken = createAccessToken({
      sub: 7,
      role: 'librarian',
      memberId: 42,
      iat: 1767225600,
      exp: 1767229200,
    })

    fetchMock.mockResolvedValue(
      jsonResponse(200, { accessToken, tokenType: 'Bearer', role: 'librarian' }),
    )

    renderLoginPage()
    fillLoginForm('librarian@library.test', 'Librarian123!')
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('librarian')
    expect(status).toHaveTextContent('member id 42')
    expect(screen.queryByRole('alert')).toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const call = firstFetchCall(fetchMock)
    expect(call.url).toBe(`${API_BASE_URL}/auth/login`)
    expect(call.init.method).toBe('POST')
    expect(call.init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(call.init.headers).not.toHaveProperty('x-service-key')
    expect(readJsonBody(call.init)).toEqual({
      email: 'librarian@library.test',
      password: 'Librarian123!',
    })
  })

  it('renders the exact server error string for invalid credentials', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Invalid credentials' }))

    renderLoginPage()
    fillLoginForm('librarian@library.test', 'WrongPassword1!')
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Invalid credentials')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders a different 401 error string verbatim instead of a hard-coded message', async () => {
    const fetchMock = createFetchMock()
    const message = 'Account locked, contact a librarian'
    fetchMock.mockResolvedValue(jsonResponse(401, { error: message }))

    renderLoginPage()
    fillLoginForm('librarian@library.test', 'Librarian123!')
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(message)
  })

  it('renders the exact Account is deactivated message for a deactivated account', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Account is deactivated' }))

    renderLoginPage()
    fillLoginForm('librarian@library.test', 'Librarian123!')
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Account is deactivated')
    expect(screen.queryByRole('status')).toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const call = firstFetchCall(fetchMock)
    expect(call.url).toBe(`${API_BASE_URL}/auth/login`)
    expect(readJsonBody(call.init)).toEqual({
      email: 'librarian@library.test',
      password: 'Librarian123!',
    })
  })
})
