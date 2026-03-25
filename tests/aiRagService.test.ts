import { Recipe } from '../src/models/Recipe';
import {
  buildContext,
  callGeminiRag,
  ragChat,
  retrieveRecipes,
} from '../src/services/aiRagService';
import * as geminiEmbeddings from '../src/services/geminiEmbeddings';
import * as llmClient from '../src/services/llmClient';
import * as aiMockService from '../src/services/aiMockService';

jest.mock('../src/models/Recipe', () => ({
  Recipe: {
    find: jest.fn(),
  },
}));

function findChain(result: any[]) {
  const chain: any = {};
  chain.sort = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.lean = jest.fn().mockResolvedValue(result);
  return chain;
}

describe('aiRagService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
  });

  test('buildContext formats recipe blocks', () => {
    const text = buildContext([
      {
        _id: 'abc',
        title: 'Recipe A',
        category: 'Other',
        ingredients: ['egg', 'salt'],
        instructions: 'Step 1\nStep 2',
      },
    ]);

    expect(text).toContain('[Recipe]');
    expect(text).toContain('title: Recipe A');
    expect(text).toContain('ingredients: egg, salt');
    expect(text).toContain('[/Recipe]');
  });

  test('callGeminiRag parses JSON from markdown code fences', async () => {
    jest.spyOn(llmClient, 'generateContent').mockResolvedValue(
      '```json\n{"answer":"ok","recommendedRecipeIds":["1"],"followUpQuestion":"more"}\n```',
    );

    const result = await callGeminiRag('hello', 'ctx', [], 'en-US');

    expect(result.answer).toBe('ok');
    expect(result.recommendedRecipeIds).toEqual(['1']);
    expect(result.followUpQuestion).toBe('more');
  });

  test('callGeminiRag falls back when response is not parseable JSON', async () => {
    jest.spyOn(llmClient, 'generateContent').mockResolvedValue('not-json at all');

    const result = await callGeminiRag('hello', 'ctx', [], 'en-US');

    expect(result.answer).toContain('could not generate');
    expect(result.recommendedRecipeIds).toEqual([]);
  });

  test('retrieveRecipes returns semantic results when enough matches exist', async () => {
    jest.spyOn(geminiEmbeddings, 'embedText').mockResolvedValue([1, 2, 3]);
    jest.spyOn(geminiEmbeddings, 'cosineSimilarity').mockReturnValue(0.9);

    const semanticCandidates = Array.from({ length: 10 }).map((_, i) => ({
      _id: `507f1f77bcf86cd7994390${(10 + i).toString().padStart(2, '0')}`,
      title: `R${i}`,
      category: 'Meat',
      instructions: 'Cook it',
      embedding: [1, 2, 3],
    }));

    (Recipe.find as jest.Mock).mockReturnValueOnce(findChain(semanticCandidates));

    const result = await retrieveRecipes('grilled meat', ['Meat']);

    expect(result.fallback).toBeUndefined();
    expect(result.recipes).toHaveLength(10);
    expect(Recipe.find).toHaveBeenCalledTimes(1);
  });

  test('retrieveRecipes uses hybrid fallback when semantic matches are sparse', async () => {
    jest.spyOn(geminiEmbeddings, 'embedText').mockResolvedValue([1, 2, 3]);
    jest.spyOn(geminiEmbeddings, 'cosineSimilarity').mockReturnValue(0.25);

    const semanticCandidates = [
      {
        _id: '507f1f77bcf86cd799439011',
        title: 'Primary',
        category: 'Meat',
        instructions: 'Cook it',
        embedding: [1, 2, 3],
      },
    ];
    const keywordCandidates = [
      {
        _id: '507f1f77bcf86cd799439012',
        title: 'Keyword A',
        category: 'Meat',
        instructions: 'Cook it',
      },
      {
        _id: '507f1f77bcf86cd799439013',
        title: 'Keyword B',
        category: 'Meat',
        instructions: 'Cook it',
      },
    ];

    (Recipe.find as jest.Mock)
      .mockReturnValueOnce(findChain(semanticCandidates))
      .mockReturnValueOnce(findChain(keywordCandidates));

    const result = await retrieveRecipes('meat', ['Meat']);

    expect(result.recipes.length).toBe(3);
    expect(result.fallback).toBe('hybrid');
  });

  test('retrieveRecipes returns empty when no semantic and no keyword results', async () => {
    jest.spyOn(geminiEmbeddings, 'embedText').mockResolvedValue([1, 2, 3]);
    jest.spyOn(geminiEmbeddings, 'cosineSimilarity').mockReturnValue(0.1);

    (Recipe.find as jest.Mock)
      .mockReturnValueOnce(findChain([]))
      .mockReturnValueOnce(findChain([]))
      .mockReturnValueOnce(findChain([]));

    const result = await retrieveRecipes('unknown dish', ['Other']);
    expect(result.recipes).toEqual([]);
  });

  test('ragChat returns deterministic mock response in mock mode', async () => {
    jest.spyOn(aiMockService, 'isMockEnabled').mockReturnValue(true);
    jest.spyOn(aiMockService, 'mockChat').mockReturnValue({
      answer: '[MOCK] Hi',
      sources: [
        {
          recipeId: 'm1',
          title: 'Mock',
          category: 'Other',
          snippet: 's',
          score: 0.9,
          reason: 'semantic',
        },
      ],
      followUpQuestion: 'more?',
    });

    const result = await ragChat('hello', 'en-US', []);
    expect(result.answer).toContain('[MOCK]');
    expect(result.sources).toHaveLength(1);
  });

  test('ragChat returns no-results response when retrieval is empty', async () => {
    jest.spyOn(aiMockService, 'isMockEnabled').mockReturnValue(false);
    jest.spyOn(geminiEmbeddings, 'embedText').mockResolvedValue([1, 2, 3]);
    jest.spyOn(geminiEmbeddings, 'cosineSimilarity').mockReturnValue(0.1);

    (Recipe.find as jest.Mock)
      .mockReturnValueOnce(findChain([]))
      .mockReturnValueOnce(findChain([]))
      .mockReturnValueOnce(findChain([]));

    const result = await ragChat('no-match', 'en-US', []);

    expect(result.primarySources).toEqual([]);
    expect(result.secondarySources).toEqual([]);
    expect(result.followUpQuestion).toContain('type of dish');
  });
});
