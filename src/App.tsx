import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { BookCatalogPage } from './pages/BookCatalogPage'
import { OverdueLoansPage } from './pages/OverdueLoansPage'
import { ProfilePage } from './pages/ProfilePage'
import { MembersPage } from './pages/MembersPage'
import { ReportsPage } from './pages/ReportsPage'

function App() {
  return (
    <div id="app">
      <h1>Library Portal</h1>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/books" element={<BookCatalogPage />} />
          <Route path="/loans/overdue" element={<OverdueLoansPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
