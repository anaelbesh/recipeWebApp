import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateContent } from '../src/services/llmClient';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(),
}));

describe('llmClient.generateContent', () => {
  let generateContentMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';

    generateContentMock = jest.fn();
    (GoogleGenerativeAI as unknown as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({
        generateContent: generateContentMock,
      })),
    }));
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  test('returns text on successful response', async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () => 'hello from model',
      },
    });

    const result = await generateContent('models/test', 'system', [], 'hello', {
      maxRetries: 0,
      timeoutMs: 100,
    });

    expect(result).toBe('hello from model');
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  test('throws no-key EmbedError when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      generateContent('models/test', 'system', [], 'hello'),
    ).rejects.toEqual(
      expect.objectContaining({
        kind: 'no-key',
        message: 'GEMINI_API_KEY is not set',
      }),
    );
  });

  test('retries on retryable error then succeeds', async () => {
    generateContentMock
      .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'socket reset' })
      .mockResolvedValueOnce({
        response: {
          text: () => 'recovered',
        },
      });

    const result = await generateContent('models/test', 'system', [], 'hello', {
      maxRetries: 1,
      timeoutMs: 200,
    });

    expect(result).toBe('recovered');
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  test('maps auth errors without retry', async () => {
    generateContentMock.mockRejectedValue({ status: 401, message: 'unauthorized' });

    await expect(
      generateContent('models/test', 'system', [], 'hello', { maxRetries: 2 }),
    ).rejects.toEqual(
      expect.objectContaining({
        kind: 'auth',
        message: 'Auth error (HTTP 401)',
      }),
    );

    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  test('maps 404 to model-not-found', async () => {
    generateContentMock.mockRejectedValue({ status: 404, message: 'missing model' });

    await expect(
      generateContent('models/missing', 'system', [], 'hello', { maxRetries: 0 }),
    ).rejects.toEqual(
      expect.objectContaining({ kind: 'model-not-found' }),
    );
  });

  test('maps 429 to quota', async () => {
    generateContentMock.mockRejectedValue({ status: 429, message: 'rate limited' });

    await expect(
      generateContent('models/test', 'system', [], 'hello', { maxRetries: 0 }),
    ).rejects.toEqual(
      expect.objectContaining({ kind: 'quota' }),
    );
  });

  test('maps unknown HTTP error to api-error', async () => {
    generateContentMock.mockRejectedValue({ status: 500, message: 'server fail' });

    await expect(
      generateContent('models/test', 'system', [], 'hello', { maxRetries: 0 }),
    ).rejects.toEqual(
      expect.objectContaining({ kind: 'api-error' }),
    );
  });

  test('maps timeout to network error', async () => {
    generateContentMock.mockImplementation(
      () => new Promise(() => undefined),
    );

    await expect(
      generateContent('models/test', 'system', [], 'hello', {
        maxRetries: 0,
        timeoutMs: 5,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        kind: 'network',
      }),
    );
  });
});
