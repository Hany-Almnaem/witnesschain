import React, { useState, useEffect } from 'react'
import { Search, Filter, Download, Shield, Clock, Globe } from 'lucide-react'

const Evidence = () => {
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterVerified, setFilterVerified] = useState('all')

  useEffect(() => {
    // TODO: Replace with actual API call
    fetchEvidence()
  }, [])

  const fetchEvidence = async () => {
    try {
      // Mock data for demonstration
      const mockEvidence = [
        {
          id: 'evidence-1',
          title: 'Human Rights Violation Evidence',
          description: 'Documentation of human rights violations',
          category: 'evidence',
          verified: true,
          uploadDate: '2024-01-15T10:00:00Z',
          size: 1024000,
          mimeType: 'video/mp4',
          accessLevel: 'public',
          contentHash: 'abc123def456'
        },
        {
          id: 'evidence-2',
          title: 'Legal Documentation',
          description: 'Legal evidence for court proceedings',
          category: 'legal',
          verified: true,
          uploadDate: '2024-01-16T14:00:00Z',
          size: 512000,
          mimeType: 'application/pdf',
          accessLevel: 'restricted',
          contentHash: 'def456ghi789'
        }
      ]
      
      setEvidence(mockEvidence)
    } catch (error) {
      console.error('Error fetching evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEvidence = evidence.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory
    const matchesVerified = filterVerified === 'all' || 
                           (filterVerified === 'verified' && item.verified) ||
                           (filterVerified === 'pending' && !item.verified)
    
    return matchesSearch && matchesCategory && matchesVerified
  })

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Browse Evidence
        </h1>
        <p className="text-lg text-gray-600">
          Search and access verified human rights documentation
        </p>
      </div>

      {/* Search and Filters */}
      <div className="card mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
                placeholder="Search evidence..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input-field"
            >
              <option value="all">All Categories</option>
              <option value="evidence">Human Rights Evidence</option>
              <option value="legal">Legal Documentation</option>
              <option value="journalism">Journalistic Content</option>
              <option value="research">Research Data</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filterVerified}
              onChange={(e) => setFilterVerified(e.target.value)}
              className="input-field"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {filteredEvidence.length === 0 ? (
          <div className="card text-center py-12">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No evidence found</h3>
            <p className="text-gray-600">
              Try adjusting your search terms or filters
            </p>
          </div>
        ) : (
          filteredEvidence.map((item) => (
            <div key={item.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.title}
                    </h3>
                    {item.verified ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Shield className="h-3 w-3 mr-1" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-3">
                    {item.description}
                  </p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Globe className="h-4 w-4 mr-1" />
                      {item.accessLevel === 'public' ? 'Public' : 'Restricted'}
                    </span>
                    <span>{formatFileSize(item.size)}</span>
                    <span>{formatDate(item.uploadDate)}</span>
                    <span className="capitalize">{item.category}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button className="btn-secondary text-sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </button>
                  <button className="btn-primary text-sm">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {filteredEvidence.length > 0 && (
        <div className="flex justify-center mt-8">
          <div className="flex items-center space-x-2">
            <button className="btn-secondary">Previous</button>
            <span className="px-4 py-2 text-sm text-gray-600">Page 1 of 1</span>
            <button className="btn-secondary">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Evidence
