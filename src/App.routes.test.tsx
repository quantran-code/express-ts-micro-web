import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App routes', () => {
  afterEach(() => {
    cleanup()
    window.history.pushState({}, '', '/')
  })

  it('still renders the Library Portal heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Library Portal' })).toBeInTheDocument()
  })

  it('redirects the root path to the login form', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Library Portal' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })
})
