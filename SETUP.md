# WitnessChain Local Development Setup

## Prerequisites

Before running WitnessChain locally, make sure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** - [Download here](https://git-scm.com/)

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Clone the repository (if not already done)
git clone https://github.com/Hany-Almnaem/witnesschain.git
cd witnesschain

# Install all dependencies
npm run install:all
```

### 2. Environment Setup

```bash
# Copy environment file for backend
cp packages/backend/env.example packages/backend/.env

# Edit the .env file if needed (optional for basic testing)
# The default values should work for local development
```

### 3. Run the Application

You have two options:

#### Option A: Run Everything Together (Recommended)
```bash
# This will start both backend and frontend
npm run dev
```

#### Option B: Run Separately
```bash
# Terminal 1 - Backend
cd packages/backend
npm run dev

# Terminal 2 - Frontend  
cd packages/frontend
npm run dev
```

### 4. Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **API Health Check:** http://localhost:3000/health

## What You'll See

### Frontend (http://localhost:5173)
- **Home Page:** Overview of WitnessChain with features and impact goals
- **Upload Page:** File upload interface with security features
- **Evidence Page:** Browse and search evidence (with mock data)
- **Verify Page:** Verification dashboard for validators

### Backend API (http://localhost:3000)
- **Health Check:** `/health` - Server status and metrics
- **Upload Endpoint:** `/api/upload` - File upload with encryption
- **Verification:** `/api/verify` - Content verification system
- **Retrieval:** `/api/retrieve` - Evidence search and download

## Testing the Features

### 1. Upload Evidence
1. Go to http://localhost:5173/upload
2. Select a file (image, video, document)
3. Add description and category
4. Click "Upload Evidence"
5. You'll see a success message with file details

### 2. Browse Evidence
1. Go to http://localhost:5173/evidence
2. Use search and filters
3. View evidence details
4. Test download functionality

### 3. Verification Dashboard
1. Go to http://localhost:5173/verify
2. View verification queue
3. See validator information
4. Test validation workflow

### 4. API Testing
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test upload endpoint
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/your/file.jpg" \
  -F "description=Test evidence" \
  -F "category=evidence"

# Test verification queue
curl http://localhost:3000/api/verify/queue
```

## Development Commands

```bash
# Install dependencies
npm run install:all

# Run development servers
npm run dev

# Run only backend
npm run dev:backend

# Run only frontend
npm run dev:frontend

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Troubleshooting

### Port Already in Use
If you get "port already in use" errors:
```bash
# Kill processes on ports 3000 and 5173
npx kill-port 3000 5173

# Or change ports in package.json scripts
```

### Node Version Issues
Make sure you're using Node.js v18 or higher:
```bash
node --version
# Should show v18.x.x or higher
```

### Missing Dependencies
If you encounter missing dependency errors:
```bash
# Clean install
rm -rf node_modules packages/*/node_modules
npm run install:all
```

### Frontend Not Loading
If the frontend shows errors:
1. Check that the backend is running on port 3000
2. Check browser console for errors
3. Try refreshing the page
4. Check that all dependencies are installed

## Project Structure

```
witnesschain/
├── packages/
│   ├── backend/          # Express.js API server
│   │   ├── src/
│   │   │   ├── index.js      # Main server file
│   │   │   └── routes/       # API routes
│   │   └── package.json
│   └── frontend/        # React.js frontend
│       ├── src/
│       │   ├── components/   # React components
│       │   ├── pages/        # Page components
│       │   └── App.jsx       # Main app component
│       └── package.json
├── docs/                # Documentation
├── package.json         # Root package.json
└── README.md
```

## Next Steps

Once you have the application running locally:

1. **Explore the UI** - Navigate through all pages
2. **Test Upload** - Try uploading different file types
3. **Check API** - Test the backend endpoints
4. **Review Code** - Look at the implementation
5. **Make Changes** - Modify and see live updates

## Need Help?

- Check the [GitHub Issues](https://github.com/Hany-Almnaem/witnesschain/issues)
- Join [GitHub Discussions](https://github.com/Hany-Almnaem/witnesschain/discussions)
- Review the [Documentation](https://github.com/Hany-Almnaem/witnesschain/tree/main/docs)

Happy coding! 🚀
