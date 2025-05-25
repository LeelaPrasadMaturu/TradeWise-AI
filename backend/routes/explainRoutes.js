const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const { explainTerm } = require('../services/aiExplainService');

// General explanation endpoint
router.post('/', auth, async (req, res) => {
  try {
    const { text, context = 'general' } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text to explain is required' });
    }

    const explanation = await explainTerm(text, context);
    res.json(explanation);
  } catch (error) {
    res.status(500).json({ message: 'Error generating explanation', error: error.message });
  }
});

// Explain a financial term
router.get('/term', auth, async (req, res) => {
  try {
    const { term, level = 'expert' } = req.query;

    if (!term) {
      return res.status(400).json({ message: 'Term is required' });
    }

    const explanation = await explainTerm(term, level);
    res.json(explanation);
  } catch (error) {
    res.status(500).json({ message: 'Error explaining term', error: error.message });
  }
});

// Generate a quiz
router.get('/quiz', auth, async (req, res) => {
  try {
    const { difficulty = 'easy', count = 5 } = req.query;
    
    // TODO: Implement quiz generation using AI
    res.json({
      message: 'Quiz generation coming soon',
      difficulty,
      count
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating quiz', error: error.message });
  }
});

// Get flashcards
router.get('/flashcards', auth, async (req, res) => {
  try {
    const { category, count = 10 } = req.query;
    
    // TODO: Implement flashcard generation using AI
    res.json({
      message: 'Flashcard generation coming soon',
      category,
      count
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating flashcards', error: error.message });
  }
});

module.exports = router; 