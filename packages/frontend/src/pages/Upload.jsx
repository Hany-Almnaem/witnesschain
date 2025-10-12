import React, { useState } from 'react'
import { Upload as UploadIcon, FileText, Shield, Lock, AlertCircle } from 'lucide-react'

const Upload = () => {
  const [file, setFile] = useState(null)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('evidence')
  const [metadata, setMetadata] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('description', description)
      formData.append('category', category)
      formData.append('metadata', metadata)

      // TODO: Replace with actual API call
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      setUploadResult(result)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadResult({ error: 'Upload failed', message: error.message })
    } finally {
      setIsUploading(false)
    }
  }

  const categories = [
    { value: 'evidence', label: 'Human Rights Evidence' },
    { value: 'legal', label: 'Legal Documentation' },
    { value: 'journalism', label: 'Journalistic Content' },
    { value: 'research', label: 'Research Data' },
    { value: 'other', label: 'Other' }
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Upload Evidence
        </h1>
        <p className="text-lg text-gray-600">
          Securely upload and preserve human rights documentation with cryptographic verification
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {file ? (
                      <div className="space-y-2">
                        <FileText className="h-12 w-12 text-primary-600 mx-auto" />
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <UploadIcon className="h-12 w-12 text-gray-400 mx-auto" />
                        <p className="text-sm font-medium text-gray-900">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">
                          Images, videos, audio, documents (max 100MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field h-24"
                  placeholder="Describe the evidence and its significance..."
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Metadata */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Metadata (JSON)
                </label>
                <textarea
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  className="input-field h-20 font-mono text-sm"
                  placeholder='{"location": "Anonymized", "date": "2024-01-15", "source": "Anonymous"}'
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!file || isUploading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Upload Evidence'}
              </button>
            </form>
          </div>
        </div>

        {/* Security Info */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-primary-600" />
              Security Features
            </h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start">
                <Lock className="h-4 w-4 mr-2 text-green-600 mt-0.5" />
                End-to-end encryption
              </li>
              <li className="flex items-start">
                <Lock className="h-4 w-4 mr-2 text-green-600 mt-0.5" />
                Decentralized storage
              </li>
              <li className="flex items-start">
                <Lock className="h-4 w-4 mr-2 text-green-600 mt-0.5" />
                Cryptographic timestamps
              </li>
              <li className="flex items-start">
                <Lock className="h-4 w-4 mr-2 text-green-600 mt-0.5" />
                Privacy-preserving identity
              </li>
            </ul>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-yellow-600" />
              Important Notes
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Files are encrypted before upload</li>
              <li>• Content will be verified by human validators</li>
              <li>• Evidence is stored permanently on Filecoin</li>
              <li>• Your identity remains private</li>
              <li>• Content cannot be deleted or censored</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className="mt-8">
          {uploadResult.error ? (
            <div className="card border-red-200 bg-red-50">
              <div className="flex items-center text-red-800">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">Upload Failed</span>
              </div>
              <p className="text-red-700 mt-2">{uploadResult.message}</p>
            </div>
          ) : (
            <div className="card border-green-200 bg-green-50">
              <div className="flex items-center text-green-800">
                <Shield className="h-5 w-5 mr-2" />
                <span className="font-medium">Upload Successful</span>
              </div>
              <p className="text-green-700 mt-2">
                Your evidence has been uploaded and is being processed. 
                You will receive a notification once verification is complete.
              </p>
              {uploadResult.data && (
                <div className="mt-4 p-4 bg-white rounded border">
                  <p className="text-sm font-medium text-gray-900">Upload Details:</p>
                  <p className="text-sm text-gray-600">ID: {uploadResult.data.id}</p>
                  <p className="text-sm text-gray-600">Hash: {uploadResult.data.contentHash}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Upload
