const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common media and document types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/webm',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  }
});

// Encryption utility
function encryptData(data, key) {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

// Generate content hash
function generateContentHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// POST /api/upload
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please upload a file'
      });
    }

    const { description, category, metadata } = req.body;
    
    // Generate encryption key (in production, this should be user-controlled)
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    
    // Encrypt file data
    const encryptedData = encryptData(req.file.buffer, encryptionKey);
    
    // Generate content hash
    const contentHash = generateContentHash(req.file.buffer);
    
    // Create metadata object
    const fileMetadata = {
      id: crypto.randomUUID(),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      contentHash,
      description: description || '',
      category: category || 'evidence',
      metadata: metadata ? JSON.parse(metadata) : {},
      timestamp: new Date().toISOString(),
      encrypted: true,
      encryptionKey: encryptionKey, // In production, this should be stored securely
      ipfsHash: null, // Will be set when uploaded to IPFS
      filecoinDealId: null, // Will be set when deal is created
      verificationStatus: 'pending'
    };

    // TODO: Upload to IPFS
    // TODO: Create Filecoin deal
    // TODO: Store metadata in database
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        id: fileMetadata.id,
        contentHash,
        timestamp: fileMetadata.timestamp,
        status: 'uploaded',
        nextSteps: [
          'File will be uploaded to IPFS',
          'Filecoin deal will be created',
          'Content will be queued for verification'
        ]
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

// GET /api/upload/status/:id
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: Retrieve status from database
    res.json({
      id,
      status: 'uploaded',
      ipfsHash: null,
      filecoinDealId: null,
      verificationStatus: 'pending',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message
    });
  }
});

module.exports = router;
