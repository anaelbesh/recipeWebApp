import mongoose from 'mongoose';
import {
  aiSearchRecipes,
  createRecipe,
  deleteRecipe,
  getCategories,
  getRecipeById,
  getRecipes,
  updateRecipe,
} from '../src/controllers/recipeController';
import * as recipeService from '../src/services/recipeService';
import { Recipe } from '../src/models/Recipe';
import { Comment } from '../src/models/Comment';
import { Like } from '../src/models/Like';
import { EmbedError } from '../src/services/geminiEmbeddings';
import * as embeddings from '../src/services/geminiEmbeddings';

jest.mock('../src/services/recipeService');
jest.mock('../src/models/Recipe', () => ({ Recipe: { findById: jest.fn(), find: jest.fn() } }));
jest.mock('../src/models/Comment', () => ({ Comment: { aggregate: jest.fn(), countDocuments: jest.fn() } }));
jest.mock('../src/models/Like', () => ({ Like: { aggregate: jest.fn(), find: jest.fn(), countDocuments: jest.fn(), exists: jest.fn() } }));
jest.mock('../src/services/geminiEmbeddings', () => ({
  ...jest.requireActual('../src/services/geminiEmbeddings'),
  embedText: jest.fn(),
  cosineSimilarity: jest.fn(),
}));

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function chain(result: any[]) {
  const c: any = {};
  c.sort = jest.fn(() => c);
  c.limit = jest.fn(() => c);
  c.populate = jest.fn(() => c);
  c.lean = jest.fn().mockResolvedValue(result);
  return c;
}

describe('recipeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getCategories returns category list', async () => {
    const res = makeRes();
    await getCategories({} as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ categories: expect.any(Array) }));
  });

  test('getRecipes returns 401 when mine=true without auth', async () => {
    const req: any = { query: { mine: 'true' } };
    const res = makeRes();

    await getRecipes(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('getRecipes returns items with meta when authenticated', async () => {
    const req: any = { query: {}, user: { id: 'u1' } };
    const res = makeRes();
    const id = new mongoose.Types.ObjectId().toString();

    (recipeService.listRecipes as jest.Mock).mockResolvedValue({ items: [{ _id: id, title: 'R' }], total: 1, page: 1, limit: 10 });
    (Comment.aggregate as jest.Mock).mockResolvedValue([{ _id: id, count: 2 }]);
    (Like.aggregate as jest.Mock).mockResolvedValue([{ _id: id, count: 3 }]);
    (Like.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ recipe: id }]) });

    await getRecipes(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].items[0]).toEqual(expect.objectContaining({ commentCount: 2, likeCount: 3, likedByMe: true }));
  });

  test('getRecipes handles service failure with 500', async () => {
    const req: any = { query: {} };
    const res = makeRes();
    (recipeService.listRecipes as jest.Mock).mockRejectedValue(new Error('db down'));

    await getRecipes(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Error fetching recipes', error: 'db down' }));
  });

  test('getRecipeById handles invalid id and not-found', async () => {
    const res1 = makeRes();
    await getRecipeById({ params: { id: 'bad' } } as any, res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = makeRes();
    (recipeService.getRecipeById as jest.Mock).mockResolvedValue(null);
    await getRecipeById({ params: { id: new mongoose.Types.ObjectId().toString() } } as any, res2);
    expect(res2.status).toHaveBeenCalledWith(404);
  });

  test('getRecipeById returns recipe with counters for authenticated user', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = makeRes();
    (recipeService.getRecipeById as jest.Mock).mockResolvedValue({ _id: id, title: 'R' });
    (Comment.countDocuments as jest.Mock).mockResolvedValue(4);
    (Like.countDocuments as jest.Mock).mockResolvedValue(6);
    (Like.exists as jest.Mock).mockResolvedValue({ _id: 'x' });

    await getRecipeById({ params: { id }, user: { id: 'u1' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].recipe).toEqual(
      expect.objectContaining({ commentCount: 4, likeCount: 6, likedByMe: true }),
    );
  });

  test('getRecipeById handles unexpected error', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = makeRes();
    (recipeService.getRecipeById as jest.Mock).mockRejectedValue(new Error('explode'));

    await getRecipeById({ params: { id } } as any, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('createRecipe validates required fields and category', async () => {
    const res1 = makeRes();
    await createRecipe({ user: { id: 'u1' }, body: { instructions: 'x', category: 'Meat' } } as any, res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = makeRes();
    await createRecipe({ user: { id: 'u1' }, body: { title: 'T', instructions: 'x', category: 'INVALID' } } as any, res2);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  test('createRecipe returns 201 on success', async () => {
    const res = makeRes();
    (recipeService.createRecipe as jest.Mock).mockResolvedValue({ _id: 'r1', title: 'T' });

    await createRecipe(
      {
        user: { id: 'u1' },
        body: { title: 'T', instructions: 'Cook', category: 'Meat', ingredients: ['a'] },
      } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Recipe created successfully' }));
  });

  test('createRecipe maps ValidationError to 400', async () => {
    const res = makeRes();
    const err: any = new Error('bad');
    err.name = 'ValidationError';
    err.errors = { title: { message: 'Title required' }, instructions: { message: 'Instructions required' } };
    (recipeService.createRecipe as jest.Mock).mockRejectedValue(err);

    await createRecipe(
      {
        user: { id: 'u1' },
        body: { title: 'T', instructions: 'Cook', category: 'Meat' },
      } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('Title required');
  });

  test('updateRecipe and deleteRecipe enforce ownership checks', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res1 = makeRes();
    (Recipe.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    await updateRecipe({ params: { id }, user: { id: 'u1' }, body: {} } as any, res1);
    expect(res1.status).toHaveBeenCalledWith(404);

    const res2 = makeRes();
    (Recipe.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue({ createdBy: new mongoose.Types.ObjectId() }) });
    await deleteRecipe({ params: { id }, user: { id: 'u1' } } as any, res2);
    expect(res2.status).toHaveBeenCalledWith(403);
  });

  test('updateRecipe handles invalid id', async () => {
    const res = makeRes();
    await updateRecipe({ params: { id: 'bad-id' }, user: { id: 'u1' }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updateRecipe updates owned recipe successfully', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const ownerId = new mongoose.Types.ObjectId().toString();
    const res = makeRes();
    (Recipe.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue({ createdBy: ownerId }) });
    (recipeService.updateRecipe as jest.Mock).mockResolvedValue({ _id: id, title: 'Updated' });

    await updateRecipe(
      {
        params: { id },
        user: { id: ownerId },
        body: { title: 'Updated', instructions: 'i', category: 'INVALID', ingredients: ['a'] },
      } as any,
      res,
    );

    expect(recipeService.updateRecipe).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ title: 'Updated', category: undefined }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updateRecipe maps ValidationError to 400', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const ownerId = new mongoose.Types.ObjectId().toString();
    const res = makeRes();
    const err: any = new Error('bad');
    err.name = 'ValidationError';
    err.errors = { title: { message: 'Bad title' } };

    (Recipe.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue({ createdBy: ownerId }) });
    (recipeService.updateRecipe as jest.Mock).mockRejectedValue(err);

    await updateRecipe(
      { params: { id }, user: { id: ownerId }, body: { title: 'X' } } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('deleteRecipe handles invalid id and success path', async () => {
    const res1 = makeRes();
    await deleteRecipe({ params: { id: 'bad-id' }, user: { id: 'u1' } } as any, res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const id = new mongoose.Types.ObjectId().toString();
    const ownerId = new mongoose.Types.ObjectId().toString();
    const res2 = makeRes();
    (Recipe.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue({ createdBy: ownerId }) });
    (recipeService.deleteRecipe as jest.Mock).mockResolvedValue({ _id: id });

    await deleteRecipe({ params: { id }, user: { id: ownerId } } as any, res2);
    expect(res2.status).toHaveBeenCalledWith(200);
    expect(res2.json).toHaveBeenCalledWith({ message: 'Recipe deleted successfully', deletedId: id });
  });

  test('aiSearchRecipes returns 400 for short query', async () => {
    const res = makeRes();
    await aiSearchRecipes({ query: { q: 'x' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('aiSearchRecipes semantic path returns scored items', async () => {
    const res = makeRes();
    jest.spyOn(embeddings, 'embedText').mockResolvedValue([1, 2, 3]);
    jest.spyOn(embeddings, 'cosineSimilarity').mockReturnValue(0.8);

    (Recipe.find as jest.Mock).mockReturnValue(chain([
      { _id: new mongoose.Types.ObjectId().toString(), title: 'R', embedding: [1, 2, 3], createdBy: { username: 'u' } },
    ]));

    await aiSearchRecipes({ query: { q: 'pasta', limit: '5' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].aiUsed).toBe(true);
  });

  test('aiSearchRecipes semantic path with no candidates returns onboarding message', async () => {
    const res = makeRes();
    jest.spyOn(embeddings, 'embedText').mockResolvedValue([1, 2, 3]);
    (Recipe.find as jest.Mock).mockReturnValue(chain([]));

    await aiSearchRecipes({ query: { q: 'pasta', category: 'All' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toEqual(
      expect.objectContaining({ aiUsed: true, totalCandidates: 0, returned: 0 }),
    );
  });

  test('aiSearchRecipes text fallback succeeds when embeddings fail', async () => {
    const res = makeRes();
    jest.spyOn(embeddings, 'embedText').mockRejectedValue(
      new EmbedError('no key', undefined, 'set key', 'no-key'),
    );

    (Recipe.find as jest.Mock).mockReturnValue(
      chain([{ _id: new mongoose.Types.ObjectId().toString(), title: 'Text Hit' }]),
    );

    await aiSearchRecipes({ query: { q: 'fallback text', category: 'Meat' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toEqual(
      expect.objectContaining({ aiUsed: false, fallback: 'textSearch', hint: 'set key' }),
    );
  });

  test('aiSearchRecipes fallback to text and then regex when embedding/text fail', async () => {
    const res = makeRes();
    jest.spyOn(embeddings, 'embedText').mockRejectedValue(new EmbedError('network', undefined, 'hint', 'network'));

    (Recipe.find as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('no text index');
      })
      .mockReturnValueOnce(chain([
        { _id: new mongoose.Types.ObjectId().toString(), title: 'Regex Hit', createdBy: { username: 'u' } },
      ]));

    await aiSearchRecipes({ query: { q: 'fallback' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ aiUsed: false, fallback: 'regexSearch' }));
  });

  test('aiSearchRecipes returns 500 when all fallback paths throw', async () => {
    const res = makeRes();
    jest.spyOn(embeddings, 'embedText').mockRejectedValue(new Error('embed fail'));

    (Recipe.find as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('text broken');
      })
      .mockImplementationOnce(() => {
        throw new Error('regex broken');
      });

    await aiSearchRecipes({ query: { q: 'failall' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Error performing AI search', error: 'regex broken' }),
    );
  });
});
