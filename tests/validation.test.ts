import {
  validateEmail,
  normalizeEmail,
  validatePassword,
  normalizePassword,
  validateUsername,
  normalizeUsername,
  PASSWORD_MIN_LENGTH,
} from '../src/shared/validation';

describe('Email Validation', () => {
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'john.doe@company.co.uk',
        'test+tag@domain.org',
        'a@b.c',
      ];

      validEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should reject email with only whitespace', () => {
      const result = validateEmail('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'user@',
        'user name@example.com',
      ];

      invalidEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('valid email address');
      });
    });

    it('should reject email exceeding 254 characters', () => {
      const longEmail = 'a'.repeat(251) + '@b.c';
      const result = validateEmail(longEmail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than 254');
    });
  });

  describe('normalizeEmail', () => {
    it('should trim whitespace', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('should convert to lowercase', () => {
      expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('should trim and lowercase together', () => {
      expect(normalizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
    });
  });
});

describe('Password Validation', () => {
  describe('validatePassword', () => {
    it('should accept strong password', () => {
      const result = validatePassword('StrongPass123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require minimum length', () => {
      const result = validatePassword('Pass1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`At least ${PASSWORD_MIN_LENGTH} characters`);
    });

    it('should require uppercase letter', () => {
      const result = validatePassword('weakpass123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least 1 uppercase letter (A-Z)');
    });

    it('should require lowercase letter', () => {
      const result = validatePassword('STRONGPASS123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least 1 lowercase letter (a-z)');
    });

    it('should require number', () => {
      const result = validatePassword('StrongPass!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least 1 number (0-9)');
    });

    it('should require special character', () => {
      const result = validatePassword('StrongPass123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least 1 special character (!@#$%^&*)');
    });

    it('should detect all missing requirements', () => {
      const result = validatePassword('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });

    it('should accept all special characters', () => {
      const specialChars = '!@#$%^&*';
      specialChars.split('').forEach((char) => {
        const result = validatePassword(`StrongPass1${char}`);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject leading/trailing spaces', () => {
      const result = validatePassword(' StrongPass123! ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No leading or trailing spaces');
    });
  });

  describe('normalizePassword', () => {
    it('should trim whitespace', () => {
      expect(normalizePassword('  StrongPass123!  ')).toBe('StrongPass123!');
    });

    it('should preserve internal spaces', () => {
      expect(normalizePassword('Strong Pass 123!')).toBe('Strong Pass 123!');
    });
  });
});

describe('Username Validation', () => {
  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      const validUsernames = [
        'john_doe',
        'chef-master',
        'User123',
        'a_b-c123',
      ];

      validUsernames.forEach((username) => {
        const result = validateUsername(username);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject empty username', () => {
      const result = validateUsername('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username is required');
    });

    it('should reject username less than 3 characters', () => {
      const result = validateUsername('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should reject username exceeding 50 characters', () => {
      const longUsername = 'a'.repeat(51);
      const result = validateUsername(longUsername);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than 50 characters');
    });

    it('should reject invalid characters', () => {
      const invalidUsernames = [
        'user@name',
        'user name',
        'user!name',
        'user#name',
      ];

      invalidUsernames.forEach((username) => {
        const result = validateUsername(username);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('letters, numbers, hyphens, and underscores');
      });
    });
  });

  describe('normalizeUsername', () => {
    it('should trim whitespace', () => {
      expect(normalizeUsername('  chef_master  ')).toBe('chef_master');
    });
  });
});

describe('Integration: Combined validation scenarios', () => {
  it('should validate complete signup with all valid fields', () => {
    const username = 'chef_master';
    const email = 'chef@example.com';
    const password = 'StrongPass123!';

    const usernameResult = validateUsername(username);
    const emailResult = validateEmail(email);
    const passwordResult = validatePassword(password);

    expect(usernameResult.valid).toBe(true);
    expect(emailResult.valid).toBe(true);
    expect(passwordResult.valid).toBe(true);
  });

  it('should detect multiple validation failures', () => {
    const username = 'ab'; // Too short
    const email = 'invalid-email'; // Invalid format
    const password = 'weak'; // Doesn't meet requirements

    const usernameResult = validateUsername(username);
    const emailResult = validateEmail(email);
    const passwordResult = validatePassword(password);

    expect(usernameResult.valid).toBe(false);
    expect(emailResult.valid).toBe(false);
    expect(passwordResult.valid).toBe(false);
  });

  it('should normalize all fields correctly', () => {
    const username = '  john_doe  ';
    const email = '  JOHN@EXAMPLE.COM  ';
    const password = '  StrongPass123!  ';

    expect(normalizeUsername(username)).toBe('john_doe');
    expect(normalizeEmail(email)).toBe('john@example.com');
    expect(normalizePassword(password)).toBe('StrongPass123!');
  });
});
