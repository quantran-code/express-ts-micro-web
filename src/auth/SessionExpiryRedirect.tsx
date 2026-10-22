import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setSessionExpiredHandler } from '../api/client'
import { clearSession } from './session'

/**
 * Registers the client's session-expired handler with the router, so a 401 on an
 * authenticated call clears the stored session and lands on the login screen once
 * instead of in every page. Renders nothing.
 */
export function SessionExpiryRedirect(): null {
  const navigate = useNavigate()

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession()
      navigate('/login', { state: { sessionExpired: true } })
    })

    return () => {
      setSessionExpiredHandler(null)
    }
  }, [navigate])

  return null
}
