import likeController from '../src/controllers/likeController';
import { Like } from '../src/models/Like';
import { createMockResponse } from './helpers/httpMocks';

jest.mock('../src/models/Like', () => ({
  Like: {
    findOne: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  },
}));

describe('likeController.toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when user is missing', async () => {
    const req: any = { params: { recipeId: 'r1' } };
    const res = createMockResponse();

    await likeController.toggle(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
  });

  test('unlikes when an existing like is found', async () => {
    const req: any = { params: { recipeId: 'r1' }, user: { id: 'u1' } };
    const res = createMockResponse();

    (Like.findOne as jest.Mock).mockResolvedValue({ _id: 'l1' });

    await likeController.toggle(req, res);

    expect(Like.findOne).toHaveBeenCalledWith({ user: 'u1', recipe: 'r1' });
    expect(Like.findByIdAndDelete).toHaveBeenCalledWith('l1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unliked', liked: false });
  });

  test('likes when no existing like is found', async () => {
    const req: any = { params: { recipeId: 'r2' }, user: { id: 'u2' } };
    const res = createMockResponse();

    (Like.findOne as jest.Mock).mockResolvedValue(null);
    (Like.create as jest.Mock).mockResolvedValue({ _id: 'l2', user: 'u2', recipe: 'r2' });

    await likeController.toggle(req, res);

    expect(Like.create).toHaveBeenCalledWith({ user: 'u2', recipe: 'r2' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Liked', liked: true }),
    );
  });

  test('returns 500 on unexpected errors', async () => {
    const req: any = { params: { recipeId: 'r1' }, user: { id: 'u1' } };
    const res = createMockResponse();

    (Like.findOne as jest.Mock).mockRejectedValue(new Error('db fail'));

    await likeController.toggle(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Server error', error: 'db fail' }),
    );
  });

  test('returns 500 when unlike delete fails', async () => {
    const req: any = { params: { recipeId: 'r1' }, user: { id: 'u1' } };
    const res = createMockResponse();

    (Like.findOne as jest.Mock).mockResolvedValue({ _id: 'l1' });
    (Like.findByIdAndDelete as jest.Mock).mockRejectedValue(new Error('delete fail'));

    await likeController.toggle(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Server error', error: 'delete fail' }),
    );
  });
});
