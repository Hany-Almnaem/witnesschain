const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// Mock validator data (in production, this would be stored in a database)
const validators = [
  { id: 'validator-1', name: 'Human Rights Validator 1', reputation: 95, active: true },
  { id: 'validator-2', name: 'Legal Evidence Validator', reputation: 98, active: true },
  { id: 'validator-3', name: 'Journalism Validator', reputation: 92, active: true }
];

// Mock verification queue
const verificationQueue = [];

// GET /api/verify/queue
router.get('/queue', (req, res) => {
  try {
    res.json({
      success: true,
      queue: verificationQueue,
      totalPending: verificationQueue.length
    });
  } catch (error) {
    console.error('Queue retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve verification queue',
      message: error.message
    });
  }
});

// POST /api/verify/submit
router.post('/submit', (req, res) => {
  try {
    const { contentId, contentHash, metadata } = req.body;
    
    if (!contentId || !contentHash) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'contentId and contentHash are required'
      });
    }

    // Create verification request
    const verificationRequest = {
      id: crypto.randomUUID(),
      contentId,
      contentHash,
      metadata: metadata || {},
      status: 'pending',
      submittedAt: new Date().toISOString(),
      assignedValidators: [],
      verificationResults: []
    };

    // Add to verification queue
    verificationQueue.push(verificationRequest);

    res.json({
      success: true,
      message: 'Content submitted for verification',
      data: {
        verificationId: verificationRequest.id,
        status: 'pending',
        estimatedTime: '24-48 hours'
      }
    });

  } catch (error) {
    console.error('Verification submission error:', error);
    res.status(500).json({
      error: 'Verification submission failed',
      message: error.message
    });
  }
});

// GET /api/verify/status/:id
router.get('/status/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Find verification request
    const verification = verificationQueue.find(v => v.id === id);
    
    if (!verification) {
      return res.status(404).json({
        error: 'Verification not found',
        message: 'The specified verification ID does not exist'
      });
    }

    res.json({
      success: true,
      data: verification
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message
    });
  }
});

// POST /api/verify/validate
router.post('/validate', (req, res) => {
  try {
    const { verificationId, validatorId, decision, comments } = req.body;
    
    if (!verificationId || !validatorId || !decision) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'verificationId, validatorId, and decision are required'
      });
    }

    // Find verification request
    const verification = verificationQueue.find(v => v.id === verificationId);
    
    if (!verification) {
      return res.status(404).json({
        error: 'Verification not found',
        message: 'The specified verification ID does not exist'
      });
    }

    // Add validator decision
    const validatorDecision = {
      validatorId,
      decision, // 'approved', 'rejected', 'needs_review'
      comments: comments || '',
      timestamp: new Date().toISOString()
    };

    verification.verificationResults.push(validatorDecision);

    // Check if we have enough validators (mock: 2 validators required)
    if (verification.verificationResults.length >= 2) {
      const approvals = verification.verificationResults.filter(r => r.decision === 'approved').length;
      const rejections = verification.verificationResults.filter(r => r.decision === 'rejected').length;
      
      if (approvals > rejections) {
        verification.status = 'verified';
      } else {
        verification.status = 'rejected';
      }
    }

    res.json({
      success: true,
      message: 'Validation submitted successfully',
      data: {
        verificationId,
        status: verification.status,
        totalValidators: verification.verificationResults.length
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      error: 'Validation failed',
      message: error.message
    });
  }
});

// GET /api/verify/validators
router.get('/validators', (req, res) => {
  try {
    res.json({
      success: true,
      validators: validators.filter(v => v.active),
      total: validators.filter(v => v.active).length
    });
  } catch (error) {
    console.error('Validators retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve validators',
      message: error.message
    });
  }
});

module.exports = router;
