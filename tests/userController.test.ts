import bcrypt from 'bcrypt';
import {
  deleteUser,
  getAllUsers,
  getMe,
  getUserById,
  updateMe,
  updateUser,
} from '../src/controllers/userController';
import User from '../src/models/userModel';
import RefreshToken from '../src/models/refreshTokenModel';
import { Comment } from '../src/models/Comment';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

jest.mock('../src/models/userModel', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

jest.mock('../src/models/refreshTokenModel', () => ({
  __esModule: true,
  default: {
    deleteMany: jest.fn(),
  },
}));

jest.mock('../src/models/Comment', () => ({
  Comment: {
    deleteMany: jest.fn(),
  },
}));

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('userController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getMe returns 404 when user not found', async () => {
    const req: any = { user: { id: 'u1' } };
    const res = createRes();

    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  test('getMe returns user data', async () => {
    const req: any = { user: { id: 'u1' } };
    const res = createRes();

    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'u1', username: 'u1' }),
    });

    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ user: { _id: 'u1', username: 'u1' } });
  });

  test('getAllUsers maps users and excludes invalid rows', async () => {
    const req: any = { user: { id: 'current' } };
    const res = createRes();

    (User.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: 'u1', username: 'name1', email: 'u1@test.com', profilePicture: null },
        { _id: null },
      ]),
    });

    await getAllUsers(req, res);

    expect(User.find).toHaveBeenCalledWith({ _id: { $ne: 'current' } }, { password: 0, providerId: 0, __v: 0 });
    expect(res.json).toHaveBeenCalledWith([
      { _id: 'u1', name: 'name1', email: 'u1@test.com', profilePicture: null },
    ]);
  });

  test('getUserById returns 500 on query error', async () => {
    const req: any = { params: { id: 'u1' } };
    const res = createRes();

    (User.findById as jest.Mock).mockImplementation(() => {
      throw new Error('db');
    });

    await getUserById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('updateMe returns 400 when no valid fields are sent', async () => {
    const req: any = { user: { id: 'u1' }, body: {} };
    const res = createRes();

    await updateMe(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'No valid fields to update' });
  });

  test('updateMe trims username and stores profile picture as relative uploads path', async () => {
    const req: any = {
      user: { id: 'u1' },
      body: { username: '  newname  ' },
      file: { path: 'data\\uploads\\avatars\\u1.png' },
    };
    const res = createRes();

    (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'u1', username: 'newname' }),
    });

    await updateMe(req, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      {
        username: 'newname',
        profilePicture: '/uploads/avatars/u1.png',
      },
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updateUser returns 400 when body has no valid fields', async () => {
    const req: any = { params: { id: 'u2' }, body: {} };
    const res = createRes();

    await updateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updateUser hashes password and updates user', async () => {
    const req: any = {
      params: { id: 'u2' },
      body: { username: 'u2n', email: 'u2@test.com', password: 'Pass123!' },
    };
    const res = createRes();

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'u2' }),
    });

    await updateUser(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith('Pass123!', 10);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ password: 'hashed' }),
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('deleteUser returns 404 when user not found', async () => {
    const req: any = { params: { id: 'missing' } };
    const res = createRes();

    (User.findById as jest.Mock).mockResolvedValue(null);

    await deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  test('deleteUser cascades delete and returns 200', async () => {
    const req: any = { params: { id: 'u3' } };
    const res = createRes();

    (User.findById as jest.Mock).mockResolvedValue({ _id: 'u3' });

    await deleteUser(req, res);

    expect(Comment.deleteMany).toHaveBeenCalledWith({ user: 'u3' });
    expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ userId: 'u3' });
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('u3');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
