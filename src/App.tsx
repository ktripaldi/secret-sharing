import { Routes, Route, Link } from 'react-router-dom'
import { CreateSecretPage } from './features/secrets/CreateSecretPage.tsx'
import { ViewSecretPage } from './features/secrets/ViewSecretPage.tsx'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          🔐 Secret Share
        </Link>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CreateSecretPage />} />
          <Route path="/s/:id" element={<ViewSecretPage />} />
          <Route path="*" element={<CreateSecretPage />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <p>Zero-knowledge — encrypted in your browser. We never see your secret.</p>
      </footer>
    </div>
  )
}

export default App
