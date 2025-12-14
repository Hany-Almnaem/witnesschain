/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable x-powered-by header for security
  poweredByHeader: false,
  
  // Fix MetaMask SDK compatibility with Next.js
  // MetaMask SDK includes React Native code that needs to be stubbed
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Stub React Native modules that MetaMask SDK tries to import
      '@react-native-async-storage/async-storage': false,
    };
    
    // Ignore React Native specific modules
    config.externals = [
      ...(config.externals || []),
      '@react-native-async-storage/async-storage',
    ];
    
    return config;
  },
  
  // Enable security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
