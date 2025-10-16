const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const { explainTerm } = require('../services/aiExplainService');
const { 
  generatePersonalizedQuiz, 
  generatePersonalizedFlashcards 
} = require('../services/quizFlashcardService');

/**
 * @swagger
 * components:
 *   schemas:
 *     Explanation:
 *       type: object
 *       properties:
 *         text:
 *           type: string
 *           description: The original text or term
 *         explanation:
 *           type: string
 *           description: The AI-generated explanation
 *         context:
 *           type: string
 *           description: The context of the explanation
 *         examples:
 *           type: array
 *           items:
 *             type: string
 *           description: Example usage or scenarios
 *         relatedTerms:
 *           type: array
 *           items:
 *             type: string
 *           description: Related terms or concepts
 *     Quiz:
 *       type: object
 *       properties:
 *         questions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               correctAnswer:
 *                 type: string
 *               explanation:
 *                 type: string
 *     Flashcard:
 *       type: object
 *       properties:
 *         term:
 *           type: string
 *         definition:
 *           type: string
 *         category:
 *           type: string
 *         examples:
 *           type: array
 *           items:
 *             type: string
 */

/**
 * @swagger
 * /explain:
 *   post:
 *     summary: Get AI-generated explanation for any text
 *     tags: [Explain]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to explain
 *               context:
 *                 type: string
 *                 default: general
 *                 description: Context for the explanation
 *     responses:
 *       200:
 *         description: Explanation generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Explanation'
 *       400:
 *         description: Text is required
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Error generating explanation
 */
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

/**
 * @swagger
 * /explain/term:
 *   get:
 *     summary: Get explanation for a financial term
 *     tags: [Explain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: term
 *         required: true
 *         schema:
 *           type: string
 *         description: Financial term to explain
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, expert]
 *           default: expert
 *         description: Explanation complexity level
 *     responses:
 *       200:
 *         description: Term explanation generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Explanation'
 *       400:
 *         description: Term is required
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Error explaining term
 */
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

/**
 * @swagger
 * /explain/quiz:
 *   get:
 *     summary: Generate a trading knowledge quiz
 *     tags: [Explain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [easy, medium, hard]
 *           default: easy
 *         description: Quiz difficulty level
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of questions
 *     responses:
 *       200:
 *         description: Quiz generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quiz'
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Error generating quiz
 */
router.get('/quiz', auth, async (req, res) => {
  try {
    const { difficulty = 'medium', count = 5 } = req.query;
    
    const quiz = await generatePersonalizedQuiz(req.user._id, {
      count: parseInt(count),
      difficulty
    });
    
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ message: 'Error generating quiz', error: error.message });
  }
});

/**
 * @swagger
 * /explain/flashcards:
 *   get:
 *     summary: Generate trading concept flashcards
 *     tags: [Explain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category of flashcards (e.g., technical analysis, fundamental analysis)
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of flashcards to generate
 *     responses:
 *       200:
 *         description: Flashcards generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Flashcard'
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Error generating flashcards
 */
router.get('/flashcards', auth, async (req, res) => {
  try {
    const { category = 'all', count = 10 } = req.query;
    
    const flashcards = await generatePersonalizedFlashcards(req.user._id, {
      count: parseInt(count),
      category
    });
    
    res.json(flashcards);
  } catch (error) {
    res.status(500).json({ message: 'Error generating flashcards', error: error.message });
  }
});

module.exports = router; 