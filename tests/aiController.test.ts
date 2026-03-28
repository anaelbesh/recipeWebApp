import { Request, Response } from 'express';
import axios from 'axios';
import {
  aiRateLimiter,
  listModels,
  parseSearch,
  chat,
  backfillEmbeddings,
} from '../src/controllers/aiController';
import { ParseConfidenceError } from '../src/services/aiSearchParseService';
import { EmbedError } from '../src/services/geminiEmbeddings';
import * as aiSearchParseService from '../src/services/aiSearchParseService';
import * as aiRagService from '../src/services/aiRagService';
import * as aiMockService from '../src/services/aiMockService';
import * as geminiEmbeddings from '../src/services/geminiEmbeddings';
import { Recipe } from '../src/models/Recipe';

jest.mock('axios');
jest.mock('../src/models/Recipe', () => ({
  Recipe: {
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response & { status: jest.Mock; json: jest.Mock };
}

describe('aiController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AI_DEBUG;
    delete process.env.GEMINI_API_KEY;
  });

  describe('aiRateLimiter', () => {
    test('bypasses limiting when mock mode is enabled', () => {
      const req: any = { ip: '1.1.1.1', socket: {} };
      const res = createRes();
      const next = jest.fn();

      jest.spyOn(aiMockService, 'isMockEnabled').mockReturnValue(true);
      aiRateLimiter(req as Request, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('returns 429 after exceeding request limit', () => {
      jest.spyOn(aiMockService, 'isMockEnabled').mockReturnValue(false);

      const req: any = { ip: '2.2.2.2', socket: {} };
      const res = createRes();

      for (let i = 0; i < 20; i++) {
        const next = jest.fn();
        aiRateLimiter(req as Request, createRes(), next);
        expect(next).toHaveBeenCalled();
      }

      aiRateLimiter(req as Request, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('listModels', () => {
    test('returns 500 when GEMINI_API_KEY is missing', async () => {
      const res = createRes();

      await listModels({} as Request, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'GEMINI_API_KEY is not set' });
    });

    test('returns mapped model list on success', async () => {
      process.env.GEMINI_API_KEY = 'abc';
      const res = createRes();

      mockedAxios.get.mockResolvedValue({
        data: {
          models: [
            {
              name: 'models/a',
              displayName: 'Model A',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        },
      } as any);

      await listModels({} as Request, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        models: [
          {
            name: 'models/a',
            displayName: 'Model A',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      });
    });

    test('returns 500 on axios failure', async () => {
      process.env.GEMINI_API_KEY = 'abc';
      const res = createRes();
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      mockedAxios.get.mockRejectedValue(new Error('network fail'));

      await listModels({} as Request, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to list models' }),
      );
    });
  });

  describe('parseSearch', () => {
    test('returns 400 for invalid query', async () => {
      const req: any = { body: { query: 'x' } };
      const res = createRes();

      await parseSearch(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 200 for valid parsed query and sanitizes inputs', async () => {
      const req: any = { body: { query: ' pasta ', locale: 'xx-YY', maxResults: 999 } };
      const res = createRes();

      jest.spyOn(aiSearchParseService, 'parseSearchQuery').mockResolvedValue({
        normalizedQuery: 'pasta',
        filters: {
          categoriesInclude: ['Comfort Food'],
          kosherType: null,
          cookingMethod: null,
          keywordsInclude: ['pasta'],
          keywordsExclude: [],
          maxMinutes: null,
        },
        warnings: [],
        confidence: 0.9,
      });

      await parseSearch(req as Request, res);

      expect(aiSearchParseService.parseSearchQuery).toHaveBeenCalledWith('pasta', 'en-US', 50);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('returns 422 for ParseConfidenceError', async () => {
      const req: any = { body: { query: 'hard query' } };
      const res = createRes();

      jest.spyOn(aiSearchParseService, 'parseSearchQuery').mockRejectedValue(
        new ParseConfidenceError(['unclear'], 0.2, { normalizedQuery: 'hard query' }),
      );

      await parseSearch(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    test.each([
      {
        kind: 'quota' as const,
        status: 429,
        message: 'AI rate limit reached — please try again later',
      },
      {
        kind: 'auth' as const,
        status: 502,
        message: 'Gemini authentication error — verify GEMINI_API_KEY',
      },
    ])('maps EmbedError $kind to $status', async ({ kind, status, message }) => {
      const req: any = { body: { query: 'pasta' } };
      const res = createRes();

      jest.spyOn(aiSearchParseService, 'parseSearchQuery').mockRejectedValue(
        new EmbedError(kind, undefined, 'hint', kind),
      );

      await parseSearch(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message }),
      );
    });

    test('returns 503 for unexpected parser errors', async () => {
      const req: any = { body: { query: 'pasta' } };
      const res = createRes();
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      jest.spyOn(aiSearchParseService, 'parseSearchQuery').mockRejectedValue(
        new Error('unexpected parse crash'),
      );

      await parseSearch(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'AI service unavailable', reason: 'unexpected parse crash' }),
      );
    });
  });

  describe('chat', () => {
    test('returns 400 for invalid message', async () => {
      const req: any = { body: { message: '' } };
      const res = createRes();

      await chat(req as Request, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 200 and strips debug fields when AI_DEBUG is false', async () => {
      const req: any = {
        body: {
          message: 'hello',
          locale: 'en-US',
          history: [
            { role: 'user', content: 'u1' },
            { role: 'assistant', content: 'a1' },
            { role: 'bad', content: 'x' },
          ],
        },
      };
      const res = createRes();

      jest.spyOn(aiRagService, 'ragChat').mockResolvedValue({
        answer: 'ok',
        primarySources: [
          {
            recipeId: '1',
            title: 'R1',
            category: 'Other',
            imageUrl: '/uploads/x.jpg',
            snippet: 's',
            score: 0.9,
            reason: 'semantic',
          },
        ],
        secondarySources: [],
        sources: [
          {
            recipeId: '1',
            title: 'R1',
            category: 'Other',
            imageUrl: '/uploads/x.jpg',
            snippet: 's',
            score: 0.9,
            reason: 'semantic',
          },
        ],
        followUpQuestion: 'more?',
      });

      await chat(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.sources[0].score).toBeUndefined();
      expect(payload.sources[0].reason).toBeUndefined();
      expect(payload.answer).toBe('ok');
    });

    test('includes debug fields and fallback when AI_DEBUG is true', async () => {
      process.env.AI_DEBUG = 'true';
      const req: any = { body: { message: 'hello' } };
      const res = createRes();

      jest.spyOn(aiRagService, 'ragChat').mockResolvedValue({
        answer: 'ok',
        primarySources: [
          {
            recipeId: '1',
            title: 'R1',
            category: 'Other',
            imageUrl: '/uploads/x.jpg',
            snippet: 's',
            score: 0.9,
            reason: 'semantic',
          },
        ],
        secondarySources: [],
        sources: [
          {
            recipeId: '1',
            title: 'R1',
            category: 'Other',
            imageUrl: '/uploads/x.jpg',
            snippet: 's',
            score: 0.9,
            reason: 'semantic',
          },
        ],
        followUpQuestion: 'more?',
        fallback: 'lexical',
      });

      await chat(req as Request, res);

      const payload = res.json.mock.calls[0][0];
      expect(payload.sources[0].score).toBe(0.9);
      expect(payload.sources[0].reason).toBe('semantic');
      expect(payload.fallback).toBe('lexical');
    });

    test('maps EmbedError network to 503', async () => {
      const req: any = { body: { message: 'hello' } };
      const res = createRes();
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      jest.spyOn(aiRagService, 'ragChat').mockRejectedValue(
        new EmbedError('network', undefined, 'check', 'network'),
      );

      await chat(req as Request, res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Network error reaching AI service' }),
      );
    });

    test('returns 503 for non-EmbedError failures', async () => {
      const req: any = { body: { message: 'hello' } };
      const res = createRes();
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      jest.spyOn(aiRagService, 'ragChat').mockRejectedValue(new Error('boom'));

      await chat(req as Request, res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'AI service unavailable', reason: 'boom' }),
      );
    });
  });

  describe('backfillEmbeddings', () => {
    test('returns 500 when API key is missing', async () => {
      const res = createRes();
      await backfillEmbeddings({} as Request, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('returns 200 when no recipes are missing embeddings', async () => {
      process.env.GEMINI_API_KEY = 'abc';
      const res = createRes();

      (Recipe.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await backfillEmbeddings({} as Request, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All recipes already have embeddings.',
        updated: 0,
      });
    });

    test('returns 202 and processes missing recipe', async () => {
      process.env.GEMINI_API_KEY = 'abc';
      const res = createRes();
      jest.spyOn(console, 'log').mockImplementation(() => undefined);

      (Recipe.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: 'r1',
              title: 'T',
              category: 'Other',
              ingredients: ['a'],
              instructions: 'mix',
            },
          ]),
        }),
      });
      (Recipe.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      jest.spyOn(geminiEmbeddings, 'buildSearchText').mockReturnValue('text');
      jest.spyOn(geminiEmbeddings, 'embedText').mockResolvedValue([0.1, 0.2]);

      const timeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: any) => {
          cb();
          return 0 as any;
        });

      await backfillEmbeddings({} as Request, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(Recipe.findByIdAndUpdate).toHaveBeenCalledWith('r1', {
        searchText: 'text',
        embedding: [0.1, 0.2],
      });

      timeoutSpy.mockRestore();
    });

    test('aborts early when embedding throws quota error', async () => {
      process.env.GEMINI_API_KEY = 'abc';
      const res = createRes();
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(console, 'log').mockImplementation(() => undefined);

      (Recipe.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: 'r1',
              title: 'T1',
              category: 'Other',
              ingredients: ['a'],
              instructions: 'mix',
            },
            {
              _id: 'r2',
              title: 'T2',
              category: 'Other',
              ingredients: ['b'],
              instructions: 'mix2',
            },
          ]),
        }),
      });

      jest.spyOn(geminiEmbeddings, 'buildSearchText').mockReturnValue('text');
      jest
        .spyOn(geminiEmbeddings, 'embedText')
        .mockRejectedValueOnce(new EmbedError('quota', undefined, 'wait', 'quota'));

      const timeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: any) => {
          cb();
          return 0 as any;
        });

      await backfillEmbeddings({} as Request, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(Recipe.findByIdAndUpdate).not.toHaveBeenCalled();

      timeoutSpy.mockRestore();
    });
  });
});
