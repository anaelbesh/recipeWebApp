import {
  addComment,
  deleteComment,
  getComments,
  updateComment,
} from '../src/controllers/commentController';
import { Comment } from '../src/models/Comment';
import { Recipe } from '../src/models/Recipe';
import { createMockResponse } from './helpers/httpMocks';

jest.mock('../src/models/Comment', () => ({
  Comment: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

jest.mock('../src/models/Recipe', () => ({
  Recipe: {
    exists: jest.fn(),
  },
}));

function commentsChain(result: any[]) {
  const chain: any = {};
  chain.sort = jest.fn(() => chain);
  chain.populate = jest.fn(() => chain);
  chain.lean = jest.fn().mockResolvedValue(result);
  return chain;
}

describe('commentController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addComment', () => {
    test('returns 401 when user is missing', async () => {
      const req: any = { params: { recipeId: 'r1' }, body: { content: 'hello' } };
      const res = createMockResponse();

      await addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 400 when content is empty', async () => {
      const req: any = { params: { recipeId: 'r1' }, user: { id: 'u1' }, body: { content: '  ' } };
      const res = createMockResponse();

      await addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Comment content is required' });
    });

    test('returns 404 when recipe does not exist', async () => {
      const req: any = { params: { recipeId: 'r1' }, user: { id: 'u1' }, body: { content: 'hey' } };
      const res = createMockResponse();

      (Recipe.exists as jest.Mock).mockResolvedValue(false);

      await addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Recipe not found' });
    });

    test('creates and returns populated comment', async () => {
      const req: any = { params: { recipeId: 'r1' }, user: { id: 'u1' }, body: { content: '  hi  ' } };
      const res = createMockResponse();

      const populate = jest.fn().mockResolvedValue(undefined);
      const created = { _id: 'c1', content: 'hi', populate };

      (Recipe.exists as jest.Mock).mockResolvedValue(true);
      (Comment.create as jest.Mock).mockResolvedValue(created);

      await addComment(req, res);

      expect(Comment.create).toHaveBeenCalledWith({ user: 'u1', recipe: 'r1', content: 'hi' });
      expect(populate).toHaveBeenCalledWith('user', 'username profilePicture');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });
  });

  describe('getComments', () => {
    test('returns sorted comments', async () => {
      const req: any = { params: { recipeId: 'r1' } };
      const res = createMockResponse();

      (Comment.find as jest.Mock).mockReturnValue(commentsChain([{ _id: 'c1' }]));

      await getComments(req, res);

      expect(Comment.find).toHaveBeenCalledWith({ recipe: 'r1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ _id: 'c1' }]);
    });

    test('returns 500 when comments query fails', async () => {
      const req: any = { params: { recipeId: 'r1' } };
      const res = createMockResponse();

      (Comment.find as jest.Mock).mockImplementation(() => {
        throw new Error('db fail');
      });

      await getComments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Error fetching comments', error: 'db fail' }),
      );
    });
  });

  describe('updateComment', () => {
    test('returns 403 when user is not owner', async () => {
      const req: any = {
        params: { commentId: 'c1' },
        user: { id: 'u2' },
        body: { content: 'new' },
      };
      const res = createMockResponse();

      (Comment.findById as jest.Mock).mockResolvedValue({ user: { toString: () => 'u1' } });

      await updateComment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('updates and returns populated comment for owner', async () => {
      const req: any = {
        params: { commentId: 'c1' },
        user: { id: 'u1' },
        body: { content: '  updated  ' },
      };
      const res = createMockResponse();

      const save = jest.fn().mockResolvedValue(undefined);
      const populate = jest.fn().mockResolvedValue(undefined);
      const comment: any = { user: { toString: () => 'u1' }, content: 'old', save, populate };

      (Comment.findById as jest.Mock).mockResolvedValue(comment);

      await updateComment(req, res);

      expect(comment.content).toBe('updated');
      expect(save).toHaveBeenCalled();
      expect(populate).toHaveBeenCalledWith('user', 'username profilePicture');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(comment);
    });

    test('returns 500 when save fails', async () => {
      const req: any = {
        params: { commentId: 'c1' },
        user: { id: 'u1' },
        body: { content: 'updated' },
      };
      const res = createMockResponse();

      const comment: any = {
        user: { toString: () => 'u1' },
        save: jest.fn().mockRejectedValue(new Error('save fail')),
      };

      (Comment.findById as jest.Mock).mockResolvedValue(comment);

      await updateComment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Error updating comment', error: 'save fail' }),
      );
    });
  });

  describe('deleteComment', () => {
    test('returns 404 when comment does not exist', async () => {
      const req: any = { params: { commentId: 'missing' }, user: { id: 'u1' } };
      const res = createMockResponse();

      (Comment.findById as jest.Mock).mockResolvedValue(null);

      await deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Comment not found' });
    });

    test('deletes comment when user is owner', async () => {
      const req: any = { params: { commentId: 'c1' }, user: { id: 'u1' } };
      const res = createMockResponse();

      (Comment.findById as jest.Mock).mockResolvedValue({ user: { toString: () => 'u1' } });

      await deleteComment(req, res);

      expect(Comment.findByIdAndDelete).toHaveBeenCalledWith('c1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Comment deleted successfully' });
    });
  });
});
