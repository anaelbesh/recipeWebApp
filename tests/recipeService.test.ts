import mongoose from 'mongoose';
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  listRecipes,
  updateRecipe,
} from '../src/services/recipeService';
import { Recipe } from '../src/models/Recipe';
import * as gemini from '../src/services/geminiEmbeddings';

jest.mock('../src/models/Recipe', () => ({
  Recipe: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  },
}));

function findChain(result: any[]) {
  const c: any = {};
  c.sort = jest.fn(() => c);
  c.skip = jest.fn(() => c);
  c.limit = jest.fn(() => c);
  c.populate = jest.fn(() => c);
  c.lean = jest.fn().mockResolvedValue(result);
  return c;
}

describe('recipeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listRecipes applies mine/category/search filters and page pagination', async () => {
    const now = new Date();
    (Recipe.find as jest.Mock).mockReturnValue(
      findChain([
        { _id: new mongoose.Types.ObjectId(), title: 'Pasta', createdAt: now },
      ]),
    );
    (Recipe.countDocuments as jest.Mock).mockResolvedValue(1);

    const result = await listRecipes({
      mine: true,
      userId: new mongoose.Types.ObjectId().toString(),
      category: 'Meat',
      search: ' pasta ',
      page: 2,
      limit: 10,
      sort: '-createdAt',
    });

    expect(Recipe.find).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Meat',
        title: { $regex: 'pasta', $options: 'i' },
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(2);
    expect(result.pages).toBe(1);
  });

  test('listRecipes handles invalid cursor gracefully', async () => {
    const now = new Date();
    (Recipe.find as jest.Mock).mockReturnValue(
      findChain([
        { _id: new mongoose.Types.ObjectId(), title: 'A', createdAt: now },
      ]),
    );
    (Recipe.countDocuments as jest.Mock).mockResolvedValue(1);

    const result = await listRecipes({ cursor: 'not-base64', limit: 5 });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  test('listRecipes uses cursor range and returns nextCursor when hasMore', async () => {
    const d1 = new Date('2025-01-02T00:00:00.000Z');
    const d2 = new Date('2025-01-01T00:00:00.000Z');
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();

    const cursor = Buffer.from(
      JSON.stringify({ date: d1.toISOString(), id: id1.toString() }),
    ).toString('base64url');

    (Recipe.find as jest.Mock).mockReturnValue(
      findChain([
        { _id: id1, title: 'R1', createdAt: d1 },
        { _id: id2, title: 'R2', createdAt: d2 },
      ]),
    );
    (Recipe.countDocuments as jest.Mock).mockResolvedValue(20);

    const result = await listRecipes({ cursor, limit: 1 });

    expect(Recipe.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { createdAt: { $lt: d1 } },
          { createdAt: d1, _id: { $lt: id1 } },
        ],
      }),
    );
    expect(result.hasMore).toBe(true);
    expect(typeof result.nextCursor).toBe('string');
  });

  test('getRecipeById returns null for invalid id', async () => {
    const result = await getRecipeById('bad-id');
    expect(result).toBeNull();
  });

  test('createRecipe trims ingredients and handles async embedding failure', async () => {
    const created = {
      _id: new mongoose.Types.ObjectId(),
      title: 'T',
      category: 'Meat',
      instructions: 'cook',
      ingredients: [' a ', ' ', 'b'],
      kosherType: undefined,
      cookingMethod: undefined,
      dishType: undefined,
    };
    (Recipe.create as jest.Mock).mockResolvedValue(created);

    jest.spyOn(gemini, 'buildSearchText').mockReturnValue('search');
    jest.spyOn(gemini, 'embedText').mockRejectedValue(new Error('embed fail'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const immediateSpy = jest
      .spyOn(global, 'setImmediate')
      .mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

    const result = await createRecipe({
      title: 'T',
      instructions: 'cook',
      ingredients: [' a ', ' ', 'b'],
      category: 'Meat',
      createdBy: new mongoose.Types.ObjectId().toString(),
    });

    expect((Recipe.create as jest.Mock).mock.calls[0][0].ingredients).toEqual(['a', 'b']);
    expect(result).toBe(created);
    expect(errSpy).toHaveBeenCalled();

    immediateSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('updateRecipe returns null for invalid id and not-found', async () => {
    expect(await updateRecipe('bad-id', { title: 'x' })).toBeNull();

    (Recipe.findById as jest.Mock).mockResolvedValue(null);
    const id = new mongoose.Types.ObjectId().toString();
    expect(await updateRecipe(id, { title: 'x' })).toBeNull();
  });

  test('updateRecipe saves fields and handles async embedding failure', async () => {
    const recipe: any = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Old',
      instructions: 'Old',
      ingredients: ['x'],
      category: 'Meat',
      save: jest.fn().mockResolvedValue(undefined),
    };
    (Recipe.findById as jest.Mock).mockResolvedValue(recipe);

    jest.spyOn(gemini, 'buildSearchText').mockReturnValue('search');
    jest.spyOn(gemini, 'embedText').mockRejectedValue(new Error('embed fail'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const immediateSpy = jest
      .spyOn(global, 'setImmediate')
      .mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

    const result = await updateRecipe(recipe._id.toString(), {
      title: 'New',
      instructions: 'New I',
      ingredients: [' a ', ' '],
      category: 'Dairy',
      imageUrl: '/img.jpg',
    });

    expect(result).toBe(recipe);
    expect(recipe.title).toBe('New');
    expect(recipe.ingredients).toEqual(['a']);
    expect(recipe.save).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();

    immediateSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('deleteRecipe handles invalid id and valid deletion path', async () => {
    expect(await deleteRecipe('bad-id')).toBeNull();

    const id = new mongoose.Types.ObjectId().toString();
    const deleted = { _id: id };
    (Recipe.findByIdAndDelete as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue(deleted) });

    const result = await deleteRecipe(id);
    expect(result).toEqual(deleted);
  });
});
