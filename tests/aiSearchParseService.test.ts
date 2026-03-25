import { parseSearchQuery, ParseConfidenceError } from '../src/services/aiSearchParseService';
import { generateContent } from '../src/services/llmClient';
import { isMockEnabled, mockParse } from '../src/services/aiMockService';

jest.mock('../src/services/llmClient', () => ({
  generateContent: jest.fn(),
}));

jest.mock('../src/services/aiMockService', () => ({
  isMockEnabled: jest.fn(),
  mockParse: jest.fn(),
}));

const mockedGenerateContent = generateContent as jest.MockedFunction<typeof generateContent>;
const mockedIsMockEnabled = isMockEnabled as jest.MockedFunction<typeof isMockEnabled>;
const mockedMockParse = mockParse as jest.MockedFunction<typeof mockParse>;

describe('aiSearchParseService.parseSearchQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsMockEnabled.mockReturnValue(false);
  });

  test('returns mock parse result when mock mode is enabled', async () => {
    const mockResult = {
      normalizedQuery: 'pasta',
      filters: {
        categoriesInclude: ['Comfort Food'],
        kosherType: 'Dairy',
        cookingMethod: null,
        keywordsInclude: ['pasta'],
        keywordsExclude: [],
        maxMinutes: 30,
      },
      warnings: [],
      confidence: 0.9,
    };

    mockedIsMockEnabled.mockReturnValue(true);
    mockedMockParse.mockReturnValue(mockResult);

    const result = await parseSearchQuery('pasta', 'en-US', 10);
    expect(result).toEqual(mockResult);
    expect(mockedGenerateContent).not.toHaveBeenCalled();
  });

  test('sanitizes LLM JSON response and clamps confidence', async () => {
    mockedGenerateContent.mockResolvedValue(
      JSON.stringify({
        normalizedQuery: 'quick pasta',
        filters: {
          categoriesInclude: ['Comfort Food', 'InvalidCategory'],
          kosherType: 'Dairy',
          cookingMethod: 'Grill',
          keywordsInclude: ['pasta', 'quick', 123],
          keywordsExclude: ['spicy', false],
          maxMinutes: 25,
        },
        warnings: ['ambiguous', 100],
        confidence: 1.7,
      }),
    );

    const result = await parseSearchQuery('quick pasta', 'en-US', 10);

    expect(result.normalizedQuery).toBe('quick pasta');
    expect(result.filters.categoriesInclude).toEqual(['Comfort Food']);
    expect(result.filters.kosherType).toBe('Dairy');
    expect(result.filters.cookingMethod).toBe('Grill');
    expect(result.filters.keywordsInclude).toEqual(['pasta', 'quick']);
    expect(result.filters.keywordsExclude).toEqual(['spicy']);
    expect(result.filters.maxMinutes).toBe(25);
    expect(result.warnings).toEqual(['ambiguous']);
    expect(result.confidence).toBe(1);
  });

  test('strips markdown fences before JSON parsing', async () => {
    mockedGenerateContent.mockResolvedValue(
      '```json\n{"normalizedQuery":"soup","filters":{},"warnings":[],"confidence":0.8}\n```',
    );

    const result = await parseSearchQuery('soup', 'en-US', 10);

    expect(result.normalizedQuery).toBe('soup');
    expect(result.confidence).toBe(0.8);
    expect(result.filters.categoriesInclude).toEqual([]);
    expect(result.filters.kosherType).toBeNull();
    expect(result.filters.cookingMethod).toBeNull();
    expect(result.filters.maxMinutes).toBeNull();
  });

  test('throws ParseConfidenceError on non-JSON LLM output', async () => {
    mockedGenerateContent.mockResolvedValue('this is not json');

    await expect(parseSearchQuery('bad output', 'en-US', 10)).rejects.toEqual(
      expect.objectContaining({
        name: 'ParseConfidenceError',
        confidence: 0,
        warnings: ['LLM returned a non-JSON response — query could not be parsed'],
      }),
    );
  });

  test('throws ParseConfidenceError with fallback warning when confidence is too low', async () => {
    mockedGenerateContent.mockResolvedValue(
      JSON.stringify({
        normalizedQuery: '???',
        filters: {},
        warnings: [],
        confidence: 0.2,
      }),
    );

    try {
      await parseSearchQuery('???', 'en-US', 10);
      throw new Error('Expected ParseConfidenceError');
    } catch (err) {
      expect(err).toBeInstanceOf(ParseConfidenceError);
      const parseErr = err as ParseConfidenceError;
      expect(parseErr.confidence).toBe(0.2);
      expect(parseErr.warnings).toEqual(['Query could not be reliably parsed as a recipe search']);
      expect(parseErr.partial.normalizedQuery).toBe('???');
    }
  });
});
