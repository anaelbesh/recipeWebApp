import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { createUpload } from '../src/middleware/upload';

jest.mock('multer', () => {
  const multerMock: any = jest.fn((options: any) => ({ options }));
  multerMock.diskStorage = jest.fn((storageOptions: any) => storageOptions);

  return {
    __esModule: true,
    default: multerMock,
  };
});

describe('upload middleware factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates multer instance with expected limits and handlers', () => {
    createUpload('avatars');

    const mockedMulter = multer as unknown as jest.Mock;
    expect(mockedMulter).toHaveBeenCalledTimes(1);

    const options = mockedMulter.mock.calls[0][0];
    expect(options.limits).toEqual({ fileSize: 5 * 1024 * 1024 });
    expect(typeof options.fileFilter).toBe('function');
    expect(typeof options.storage.destination).toBe('function');
    expect(typeof options.storage.filename).toBe('function');
  });

  test('ensures destination folder exists and passes destination path', () => {
    createUpload('recipe-images');

    const mockedMulter = multer as unknown as jest.Mock;
    const options = mockedMulter.mock.calls[0][0];
    const destination = options.storage.destination as Function;
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
    const cb = jest.fn();

    destination({}, {}, cb);

    const expectedDest = path.resolve('data', 'uploads', 'recipe-images');
    expect(mkdirSpy).toHaveBeenCalledWith(expectedDest, { recursive: true });
    expect(cb).toHaveBeenCalledWith(null, expectedDest);

    mkdirSpy.mockRestore();
  });

  test('builds filename with user id and original extension', () => {
    createUpload('avatars');

    const mockedMulter = multer as unknown as jest.Mock;
    const options = mockedMulter.mock.calls[0][0];
    const filename = options.storage.filename as Function;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const cb = jest.fn();

    filename({ user: { id: 'user-1' } }, { originalname: 'photo.PNG' }, cb);

    expect(cb).toHaveBeenCalledWith(null, 'user-1-1700000000000.png');
    nowSpy.mockRestore();
  });

  test('falls back to unknown user and jpg extension when missing', () => {
    createUpload('avatars');

    const mockedMulter = multer as unknown as jest.Mock;
    const options = mockedMulter.mock.calls[0][0];
    const filename = options.storage.filename as Function;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000001);
    const cb = jest.fn();

    filename({}, { originalname: 'file' }, cb);

    expect(cb).toHaveBeenCalledWith(null, 'unknown-1700000000001.jpg');
    nowSpy.mockRestore();
  });

  test('allows only jpeg/png/webp mimetypes', () => {
    createUpload('avatars');

    const mockedMulter = multer as unknown as jest.Mock;
    const options = mockedMulter.mock.calls[0][0];
    const fileFilter = options.fileFilter as Function;

    const allowCb = jest.fn();
    fileFilter({}, { mimetype: 'image/png' }, allowCb);
    expect(allowCb).toHaveBeenCalledWith(null, true);

    const denyCb = jest.fn();
    fileFilter({}, { mimetype: 'image/gif' }, denyCb);
    const err = denyCb.mock.calls[0][0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Only jpg, png, and webp images are allowed');
  });
});
