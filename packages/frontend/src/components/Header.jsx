import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Upload, Search, CheckCircle } from 'lucide-react'

const Header = ({ isConnected, setIsConnected }) => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Home', icon: Shield },
    { path: '/upload', label: 'Upload', icon: Upload },
    { path: '/evidence', label: 'Evidence', icon: Search },
    { path: '/verify', label: 'Verify', icon: CheckCircle }
  ]

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">WitnessChain</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Connection Status */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              isConnected 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            <button
              onClick={() => setIsConnected(!isConnected)}
              className="btn-primary text-sm"
            >
              {isConnected ? 'Disconnect' : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
