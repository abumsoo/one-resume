import { BrowserRouter, Link, Route, Routes } from 'react-router'
import EditResume from './pages/EditResume'
import Home from './pages/Home'

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

/** The pages, without a router, so tests can wrap them in a MemoryRouter. */
export function AppRoutes() {
  return (
    <>
      <header className="app-bar">
        <Link to="/">One Resume</Link>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* The main resume. Tailored resumes will get /resumes/:id/edit. */}
        <Route path="/edit" element={<EditResume />} />
      </Routes>
    </>
  )
}
