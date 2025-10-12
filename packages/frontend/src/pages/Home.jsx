import React from 'react'
import { Link } from 'react-router-dom'
import { Shield, Upload, Search, CheckCircle, Lock, Globe, Users, FileText } from 'lucide-react'

const Home = () => {
  const features = [
    {
      icon: Shield,
      title: 'Immutable Storage',
      description: 'Evidence stored on Filecoin with cryptographic timestamps that cannot be tampered with or deleted.'
    },
    {
      icon: Lock,
      title: 'Privacy Protection',
      description: 'End-to-end encryption and decentralized identity to protect witnesses and sources.'
    },
    {
      icon: Globe,
      title: 'Censorship Resistant',
      description: 'Distributed storage across IPFS network ensures content cannot be censored or blocked.'
    },
    {
      icon: Users,
      title: 'Community Verified',
      description: 'Human validators verify content authenticity through decentralized verification network.'
    }
  ]

  const stats = [
    { label: 'Evidence Preserved', value: '1,000+', description: 'Verified submissions' },
    { label: 'Countries Covered', value: '50+', description: 'Global reach' },
    { label: 'Storage on Filecoin', value: '5+ TB', description: 'Decentralized storage' },
    { label: 'Safety Record', value: '0', description: 'User safety incidents' }
  ]

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          Preserve Truth on the{' '}
          <span className="text-primary-600">Decentralized Web</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          WitnessChain is a decentralized platform that preserves and verifies human rights 
          documentation using Filecoin, IPFS, and blockchain technology. Ensure evidence 
          persists when it matters most.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/upload" className="btn-primary text-lg px-8 py-3">
            <Upload className="h-5 w-5 mr-2" />
            Upload Evidence
          </Link>
          <Link to="/evidence" className="btn-secondary text-lg px-8 py-3">
            <Search className="h-5 w-5 mr-2" />
            Browse Evidence
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why WitnessChain?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            In politically unstable regions, evidence can disappear within hours. 
            WitnessChain ensures truth persists on the decentralized web.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="card text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-primary-100 rounded-full">
                    <Icon className="h-8 w-8 text-primary-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary-50 rounded-2xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Impact Goals
          </h2>
          <p className="text-lg text-gray-600">
            Our mission to preserve human rights evidence at scale
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">
                {stat.value}
              </div>
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {stat.label}
              </div>
              <div className="text-gray-600">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 text-center">
        <div className="card max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Preserve Evidence?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join the fight for truth and justice. Upload evidence, verify content, 
            and help build a more transparent world.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/upload" className="btn-primary text-lg px-8 py-3">
              <FileText className="h-5 w-5 mr-2" />
              Start Uploading
            </Link>
            <Link to="/verify" className="btn-secondary text-lg px-8 py-3">
              <CheckCircle className="h-5 w-5 mr-2" />
              Become Validator
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
