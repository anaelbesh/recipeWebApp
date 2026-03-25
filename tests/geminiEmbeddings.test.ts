import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  EmbedError,
  buildSearchText,
  cosineSimilarity,
  embedText,
} from '../src/services/geminiEmbeddings';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(),
}));

describe('geminiEmbeddings', () => {
  let embedContentMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';

    embedContentMock = jest.fn();
    (GoogleGenerativeAI as unknown as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({
        embedContent: embedContentMock,
      })),
    }));
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  test('throws no-key error when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(embedText('hello')).rejects.toEqual(
      expect.objectContaining({
        kind: 'no-key',
        message: 'GEMINI_API_KEY is not set',
      }),
    );
  });

  test('returns embedding values on success', async () => {
    embedContentMock.mockResolvedValue({ embedding: { values: [0.1, 0.2, 0.3] } });

    const values = await embedText('hello');
    expect(values).toEqual([0.1, 0.2, 0.3]);
  });

  test('throws api-error when vector is empty', async () => {
    embedContentMock.mockResolvedValue({ embedding: { values: [] } });

    await expect(embedText('hello')).rejects.toEqual(
      expect.objectContaining({
        kind: 'api-error',
        message: 'Gemini returned an empty embedding vector',
      }),
    );
  });

  test('maps 404 error to model-not-found', async () => {
    embedContentMock.mockRejectedValue({ status: 404, message: 'not found' });

    await expect(embedText('hello')).rejects.toEqual(
      expect.objectContaining({ kind: 'model-not-found' }),
    );
  });

  test('maps 401/403 error to auth', async () => {
    embedContentMock.mockRejectedValue({ status: 401, message: 'unauthorized' });
    await expect(embedText('hello')).rejects.toEqual(
      expect.objectContaining({ kind: 'auth' }),
    );

    embedContentMock.mockRejectedValue({ status: 403, message: 'forbidden' });
    await expect(embedText('hello')).rejects.toEqual(
      expect.objectContaining({ kind: 'auth' }),
    );
  });

  test('maps 429 error to quota', async () => {
    embedContentMock.mockRejectedValue({ status: 429, message: 'rate limited' });

    await expect(embedText('hello')).rejects.toEqual(
      expect.objectContaining({ kind: 'quota' }),
    );
  });

  test('maps ENOTFOUND to network', async () => {
    embedContentMock.mockRejectedValue({ code: 'ENOTFOUND', message: 'dns' });

    await expect(embedText('hello')).rejects.toEqual(
      expect.objectContaining({ kind: 'network' }),
    );
  });

  test('maps unknown HTTP errors to api-error', async () => {
    embedContentMock.mockRejectedValue({ status: 500, message: 'server fail' });

    await expect(embedText('hello')).rejects.toEqual(
      expect.objectContaining({ kind: 'api-error' }),
    );
  });

  test('cosineSimilarity handles invalid shapes and zero norms', () => {
    expect(cosineSimilarity([], [1, 2])).toBe(-1);
    expect(cosineSimilarity([1], [1, 2])).toBe(-1);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(-1);
  });

  test('cosineSimilarity computes expected similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  test('buildSearchText includes optional tags when present', () => {
    const text = buildSearchText(
      'Title',
      'Breakfast',
      ['egg', 'milk'],
      'Some instructions',
      'Dairy',
      'Pan',
      'Main',
    );

    expect(text).toContain('Title');
    expect(text).toContain('Breakfast');
    expect(text).toContain('egg, milk');
    expect(text).toContain('kosher:Dairy');
    expect(text).toContain('method:Pan');
    expect(text).toContain('dish:Main');
  });
});
