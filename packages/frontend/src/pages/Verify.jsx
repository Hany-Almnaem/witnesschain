import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Users, Shield, AlertCircle } from 'lucide-react'

const Verify = () => {
  const [validators, setValidators] = useState([])
  const [verificationQueue, setVerificationQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Mock data for demonstration
      const mockValidators = [
        { id: 'validator-1', name: 'Human Rights Validator 1', reputation: 95, active: true },
        { id: 'validator-2', name: 'Legal Evidence Validator', reputation: 98, active: true },
        { id: 'validator-3', name: 'Journalism Validator', reputation: 92, active: true }
      ]

      const mockQueue = [
        {
          id: 'verification-1',
          contentId: 'evidence-1',
          contentHash: 'abc123def456',
          status: 'pending',
          submittedAt: '2024-01-15T10:00:00Z',
          assignedValidators: ['validator-1', 'validator-2'],
          verificationResults: []
        },
        {
          id: 'verification-2',
          contentId: 'evidence-2',
          contentHash: 'def456ghi789',
          status: 'verified',
          submittedAt: '2024-01-16T14:00:00Z',
          assignedValidators: ['validator-1', 'validator-3'],
          verificationResults: [
            { validatorId: 'validator-1', decision: 'approved', timestamp: '2024-01-16T14:30:00Z' },
            { validatorId: 'validator-3', decision: 'approved', timestamp: '2024-01-16T14:45:00Z' }
          ]
        }
      ]

      setValidators(mockValidators)
      setVerificationQueue(mockQueue)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleValidation = async (verificationId, decision) => {
    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/verify/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          verificationId,
          validatorId: 'current-validator', // In real app, this would be the logged-in validator
          decision,
          comments: ''
        })
      })

      const result = await response.json()
      if (result.success) {
        // Refresh data
        fetchData()
      }
    } catch (error) {
      console.error('Validation error:', error)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
          Verification Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Review and verify human rights evidence submissions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Verification Queue */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-primary-600" />
              Verification Queue
            </h2>
            
            <div className="space-y-4">
              {verificationQueue.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No items in verification queue</p>
                </div>
              ) : (
                verificationQueue.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Verification #{item.id.split('-')[1]}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Content Hash: {item.contentHash}
                        </p>
                        <p className="text-sm text-gray-500">
                          Submitted: {formatDate(item.submittedAt)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {item.status === 'verified' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </span>
                        ) : item.status === 'rejected' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-2">Assigned Validators:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.assignedValidators.map((validatorId) => {
                          const validator = validators.find(v => v.id === validatorId)
                          return (
                            <span key={validatorId} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                              {validator?.name || validatorId}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    
                    {item.verificationResults.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-2">Validation Results:</p>
                        <div className="space-y-1">
                          {item.verificationResults.map((result, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">
                                Validator {result.validatorId.split('-')[1]}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                result.decision === 'approved' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {result.decision}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {item.status === 'pending' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleValidation(item.id, 'approved')}
                          className="btn-primary text-sm"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleValidation(item.id, 'rejected')}
                          className="btn-secondary text-sm bg-red-600 hover:bg-red-700 text-white"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Validator Info */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-primary-600" />
              Active Validators
            </h3>
            <div className="space-y-3">
              {validators.filter(v => v.active).map((validator) => (
                <div key={validator.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{validator.name}</p>
                    <p className="text-xs text-gray-500">ID: {validator.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{validator.reputation}%</p>
                    <p className="text-xs text-gray-500">Reputation</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-primary-600" />
              Verification Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Queue</span>
                <span className="text-sm font-medium">{verificationQueue.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="text-sm font-medium">
                  {verificationQueue.filter(item => item.status === 'pending').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Verified</span>
                <span className="text-sm font-medium">
                  {verificationQueue.filter(item => item.status === 'verified').length}
                </span>
              </div>
            </div>
          </div>

          <div className="card border-yellow-200 bg-yellow-50">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Important</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Verification requires careful review of content authenticity. 
                  Only approve evidence that has been properly verified.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Verify
