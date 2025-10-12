import React from 'react'
import { Shield, Github, Twitter, Mail } from 'lucide-react'

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="h-8 w-8 text-primary-400" />
              <span className="text-xl font-bold">WitnessChain</span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              Decentralized platform for preserving and verifying human rights documentation 
              using Filecoin, IPFS, and blockchain technology.
            </p>
            <div className="flex space-x-4">
              <a 
                href="https://github.com/Hany-Almnaem/witnesschain" 
                className="text-gray-400 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-5 w-5" />
              </a>
              <a 
                href="https://twitter.com/witnesschain" 
                className="text-gray-400 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a 
                href="mailto:contact@witnesschain.org" 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="/" className="text-gray-400 hover:text-white transition-colors">Home</a></li>
              <li><a href="/upload" className="text-gray-400 hover:text-white transition-colors">Upload Evidence</a></li>
              <li><a href="/evidence" className="text-gray-400 hover:text-white transition-colors">Browse Evidence</a></li>
              <li><a href="/verify" className="text-gray-400 hover:text-white transition-colors">Verify Content</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li><a href="/docs" className="text-gray-400 hover:text-white transition-colors">Documentation</a></li>
              <li><a href="/security" className="text-gray-400 hover:text-white transition-colors">Security</a></li>
              <li><a href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="/support" className="text-gray-400 hover:text-white transition-colors">Support</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 WitnessChain. All rights reserved. MIT License.
            </p>
            <p className="text-gray-400 text-sm mt-2 md:mt-0">
              Built with ❤️ for human rights
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
