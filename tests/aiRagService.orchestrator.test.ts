function makeChain(result: any[]) {
  const c: any = {};
  c.sort = jest.fn(() => c);
  c.limit = jest.fn(() => c);
  c.lean = jest.fn().mockResolvedValue(result);
  return c;
}

describe('aiRagService orchestrator branches', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'k';
  });

  test('ragChat applies intent categories, hybrid fallback and secondary sources', async () => {
    const findMock = jest.fn((query: any, projection?: any) => {
      const hasEmbedding = query?.embedding?.$exists;
      const isText = query?.$text?.$search;
      const isRegex = query?.title?.$regex;

      if (hasEmbedding && query?.category?.$in) {
        return makeChain([
          {
            _id: '507f1f77bcf86cd799439011',
            title: 'Primary Semantic',
            category: 'Meat',
            instructions: 'Cook this dish now',
            embedding: [1, 2, 3],
            _reason: 'semantic',
          },
        ]);
      }
      if (isText && projection?.score) {
        return makeChain([
          {
            _id: '507f1f77bcf86cd799439012',
            title: 'Primary Keyword',
            category: 'Comfort Food',
            instructions: 'Keyword fallback recipe',
            _reason: 'keyword-fallback',
          },
        ]);
      }
      if (isRegex) {
        return makeChain([]);
      }
      if (hasEmbedding && !query?.category) {
        return makeChain([
          {
            _id: '507f1f77bcf86cd799439013',
            title: 'Secondary Pick',
            category: 'Asian',
            instructions: 'Secondary suggestion text',
            embedding: [1, 2, 3],
            _reason: 'semantic',
          },
        ]);
      }

      return makeChain([]);
    });

    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        get: jest.fn().mockResolvedValue({
          data: {
            models: [
              { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
            ],
          },
        }),
      },
    }));
    jest.doMock('../src/models/Recipe', () => ({ Recipe: { find: findMock } }));
    jest.doMock('../src/services/geminiEmbeddings', () => ({
      GEMINI_EMBED_MODEL: 'models/text-embedding-004',
      embedText: jest.fn().mockResolvedValue([1, 2, 3]),
      cosineSimilarity: jest.fn().mockReturnValue(0.8),
    }));
    jest.doMock('../src/services/llmClient', () => ({
      generateContent: jest.fn().mockResolvedValue(
        JSON.stringify({
          answer: 'Try these options',
          recommendedRecipeIds: ['507f1f77bcf86cd799439011'],
          followUpQuestion: 'Want another style?',
        }),
      ),
    }));
    jest.doMock('../src/services/aiMockService', () => ({
      isMockEnabled: jest.fn().mockReturnValue(false),
      mockChat: jest.fn(),
    }));

    const rag = await import('../src/services/aiRagService');
    const result = await rag.ragChat('best pasta ideas', 'en-US', []);

    expect(findMock).toHaveBeenCalled();
    expect(findMock.mock.calls[0][0].category.$in).toEqual(['Meat', 'Comfort Food']);
    expect(result.primarySources.length).toBeGreaterThan(0);
    expect(result.secondarySources.length).toBeGreaterThan(0);
    expect(result.sources).toEqual(result.primarySources);
  });

  test('ragChat continues when model validation fails (non-fatal)', async () => {
    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        get: jest.fn().mockRejectedValue(new Error('timeout')),
      },
    }));
    jest.doMock('../src/models/Recipe', () => ({
      Recipe: {
        find: jest.fn(() => makeChain([])),
      },
    }));
    jest.doMock('../src/services/geminiEmbeddings', () => ({
      GEMINI_EMBED_MODEL: 'models/text-embedding-004',
      embedText: jest.fn().mockResolvedValue([1, 2, 3]),
      cosineSimilarity: jest.fn().mockReturnValue(0.1),
    }));
    jest.doMock('../src/services/llmClient', () => ({
      generateContent: jest.fn(),
    }));
    jest.doMock('../src/services/aiMockService', () => ({
      isMockEnabled: jest.fn().mockReturnValue(false),
      mockChat: jest.fn(),
    }));

    const rag = await import('../src/services/aiRagService');
    const result = await rag.ragChat('unknown query', 'en-US', []);

    expect(result.primarySources).toEqual([]);
    expect(result.followUpQuestion).toContain('type of dish');
  });

  test('ragChat honors explicit category over intent keywords', async () => {
    const findMock = jest.fn((query: any) => {
      if (query?.embedding?.$exists) {
        return makeChain([
          {
            _id: '507f1f77bcf86cd799439014',
            title: 'Dairy Pick',
            category: 'Dairy',
            instructions: 'A dairy meal',
            embedding: [1, 2, 3],
            _reason: 'semantic',
          },
        ]);
      }
      return makeChain([]);
    });

    jest.doMock('axios', () => ({
      __esModule: true,
      default: { get: jest.fn().mockResolvedValue({ data: { models: [] } }) },
    }));
    jest.doMock('../src/models/Recipe', () => ({ Recipe: { find: findMock } }));
    jest.doMock('../src/services/geminiEmbeddings', () => ({
      GEMINI_EMBED_MODEL: 'models/text-embedding-004',
      embedText: jest.fn().mockResolvedValue([1, 2, 3]),
      cosineSimilarity: jest.fn().mockReturnValue(0.8),
    }));
    jest.doMock('../src/services/llmClient', () => ({
      generateContent: jest.fn().mockResolvedValue(
        JSON.stringify({ answer: 'ok', recommendedRecipeIds: [], followUpQuestion: '' }),
      ),
    }));
    jest.doMock('../src/services/aiMockService', () => ({
      isMockEnabled: jest.fn().mockReturnValue(false),
      mockChat: jest.fn(),
    }));

    const rag = await import('../src/services/aiRagService');
    await rag.ragChat('pasta', 'en-US', [], 'Dairy');

    expect(findMock.mock.calls[0][0].category.$in).toEqual(['Dairy']);
  });

  test('model validation logs warnings for unsupported methods and runs once', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const axiosGet = jest.fn().mockResolvedValue({
      data: {
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: [] },
          { name: 'models/text-embedding-004', supportedGenerationMethods: [] },
        ],
      },
    });

    jest.doMock('axios', () => ({
      __esModule: true,
      default: { get: axiosGet },
    }));
    jest.doMock('../src/models/Recipe', () => ({ Recipe: { find: jest.fn(() => makeChain([])) } }));
    jest.doMock('../src/services/geminiEmbeddings', () => ({
      GEMINI_EMBED_MODEL: 'models/text-embedding-004',
      embedText: jest.fn().mockResolvedValue([1, 2, 3]),
      cosineSimilarity: jest.fn().mockReturnValue(0.1),
    }));
    jest.doMock('../src/services/llmClient', () => ({ generateContent: jest.fn() }));
    jest.doMock('../src/services/aiMockService', () => ({
      isMockEnabled: jest.fn().mockReturnValue(false),
      mockChat: jest.fn(),
    }));

    const rag = await import('../src/services/aiRagService');
    await rag.ragChat('x1', 'en-US', []);
    await rag.ragChat('x2', 'en-US', []);

    expect(axiosGet).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
