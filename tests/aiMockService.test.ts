import { isMockEnabled, mockChat, mockParse } from '../src/services/aiMockService';

describe('aiMockService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LLM_MOCK_MODE;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('isMockEnabled handles mode matrix', () => {
    process.env.LLM_MOCK_MODE = 'always';
    expect(isMockEnabled()).toBe(true);

    process.env.LLM_MOCK_MODE = 'development';
    process.env.NODE_ENV = 'development';
    expect(isMockEnabled()).toBe(true);

    process.env.LLM_MOCK_MODE = 'test';
    process.env.NODE_ENV = 'test';
    expect(isMockEnabled()).toBe(true);

    process.env.LLM_MOCK_MODE = 'never';
    expect(isMockEnabled()).toBe(false);
  });

  test('mockParse maps strong signals to filters and confidence', () => {
    const result = mockParse('bbq chicken under 30 min no spicy', 'en-US', 10);

    expect(result.filters.cookingMethod).toBe('Grill');
    expect(result.filters.kosherType).toBe('Meat');
    expect(result.filters.maxMinutes).toBe(30);
    expect(result.filters.keywordsExclude).toContain('spicy');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test('mockParse keeps lower confidence when no strong signal', () => {
    const result = mockParse('please suggest something nice', 'en-US', 10);
    expect(result.confidence).toBe(0.5);
  });

  test('mockChat handles multiple keyword branches', () => {
    expect(mockChat('pasta ideas', 'en-US').answer).toContain('[MOCK]');
    expect(mockChat('pizza tonight', 'en-US').answer).toContain('[MOCK]');
    expect(mockChat('burger please', 'en-US').answer).toContain('[MOCK]');
    expect(mockChat('asian dinner', 'en-US').answer).toContain('[MOCK]');
    expect(mockChat('gluten free meals', 'en-US').answer).toContain('[MOCK]');
    expect(mockChat('some random thing', 'en-US').sources).toHaveLength(2);
  });
});
