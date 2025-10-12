import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Upload from './pages/Upload'
import Evidence from './pages/Evidence'
import Verify from './pages/Verify'
import Footer from './components/Footer'

function App() {
  const [isConnected, setIsConnected] = useState(false)

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header isConnected={isConnected} setIsConnected={setIsConnected} />
        
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/verify" element={<Verify />} />
          </Routes>
        </main>
        
        <Footer />
      </div>
    </Router>
  )
}

export default App
