import { uploadRecipeImage } from '../src/controllers/uploadController';
import { createMockResponse } from './helpers/httpMocks';

describe('uploadController.uploadRecipeImage', () => {
  test('returns 400 when no file is present', async () => {
    const req: any = {};
    const res = createMockResponse();

    await uploadRecipeImage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
  });

  test('returns image url when file is present', async () => {
    const req: any = { file: { filename: 'img-1.png' } };
    const res = createMockResponse();

    await uploadRecipeImage(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ imageUrl: '/uploads/recipe-images/img-1.png' });
  });
});
