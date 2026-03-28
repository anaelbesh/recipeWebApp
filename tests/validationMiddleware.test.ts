import { validateLoginRequest, validateSignupRequest } from '../src/middleware/validationMiddleware';

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('validationMiddleware', () => {
  describe('validateLoginRequest', () => {
    test('returns 400 when email and password are missing', () => {
      const req: any = { body: {} };
      const res = createRes();
      const next = jest.fn();

      validateLoginRequest(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          email: 'Email is required',
          password: 'Password is required',
        },
      });
    });

    test('returns 400 for invalid email format', () => {
      const req: any = { body: { email: 'bad-email', password: 'Pass123!' } };
      const res = createRes();
      const next = jest.fn();

      validateLoginRequest(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.objectContaining({
            email: expect.any(String),
          }),
        }),
      );
    });

    test('normalizes email and calls next for valid payload', () => {
      const req: any = { body: { email: '  USER@Example.COM  ', password: 'Pass123!' } };
      const res = createRes();
      const next = jest.fn();

      validateLoginRequest(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(req.validated).toEqual({
        email: 'user@example.com',
        password: 'Pass123!',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateSignupRequest', () => {
    test('returns 400 when required fields are missing', () => {
      const req: any = { body: {} };
      const res = createRes();
      const next = jest.fn();

      validateSignupRequest(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          username: 'Username is required',
          email: 'Email is required',
          password: 'Password is required',
        },
      });
    });

    test('returns 400 when password is weak', () => {
      const req: any = {
        body: {
          username: 'valid_user',
          email: 'user@example.com',
          password: 'weak',
        },
      };
      const res = createRes();
      const next = jest.fn();

      validateSignupRequest(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.objectContaining({
            password: expect.any(Array),
          }),
        }),
      );
    });

    test('normalizes username/email/password and calls next for valid payload', () => {
      const req: any = {
        body: {
          username: '  Chef_User  ',
          email: '  CHEF@Example.COM ',
          password: 'StrongPass1!',
        },
      };
      const res = createRes();
      const next = jest.fn();

      validateSignupRequest(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(req.validated).toEqual({
        username: 'Chef_User',
        email: 'chef@example.com',
        password: 'StrongPass1!',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
