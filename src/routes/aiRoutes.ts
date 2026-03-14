import { Router } from 'express';
import { chat, listModels, backfillEmbeddings, parseSearch, aiRateLimiter } from '../controllers/aiController';
import { verifyToken } from '../middleware/authMiddleware';

const router = Router();

// GET  /api/ai/models — debug: list available Gemini models for the API key
router.get('/models', listModels as any);

// POST /api/ai/search/parse — parse free-text query into structured search object
router.post('/search/parse', aiRateLimiter as any, parseSearch as any);

// POST /api/ai/chat — RAG assistant (answer + grounded sources)
router.post('/chat', aiRateLimiter as any, chat as any);

// POST /api/ai/backfill-embeddings — generate embeddings for recipes missing them (auth required)
router.post('/backfill-embeddings', verifyToken, backfillEmbeddings as any);

export default router;
