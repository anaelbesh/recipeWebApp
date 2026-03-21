/**
 * # Authentication Input Validation - Developer Guide
 *
 * This file documents how to use and extend the auth validation system.
 *
 * ## Quick Start
 *
 * ### For Frontend Developers
 *
 * ```typescript
 * import {
 *   validateEmail,
 *   validatePassword,
 *   validateUsername,
 *   normalizeEmail,
 *   normalizePassword,
 *   normalizeUsername,
 * } from '../utils/validation';
 *
 * // Validate a field
 * const emailValidation = validateEmail(userInput);
 * if (!emailValidation.valid) {
 *   console.error(emailValidation.error); // User-friendly message
 * }
 *
 * // Get detailed password feedback
 * const passwordValidation = validatePassword(userInput);
 * console.log(passwordValidation.errors); // Array of requirement errors
 * console.log(passwordValidation.requirements); // Object showing which requirements are met
 *
 * // Normalize before sending to server
 * const cleanEmail = normalizeEmail(userInput);
 * const cleanPassword = normalizePassword(userInput);
 * ```
 *
 * ### For Backend Developers
 *
 * ```typescript
 * import { validateLoginRequest, validateSignupRequest } from '../middleware/validationMiddleware';
 * import { ValidatedAuthRequest } from '../middleware/validationMiddleware';
 *
 * // Middleware automatically validates and returns 400 on failure
 * router.post('/login', validateLoginRequest, loginController);
 *
 * // In controller, access normalized values
 * const loginController = (req: ValidatedAuthRequest, res: Response) => {
 *   const { email, password } = req.validated!; // Always valid!
 *   // email is already normalized (lowercase, trimmed)
 *   // password is already trimmed
 * };
 * ```
 *
 * ## Validation Rules
 *
 * ### Email
 * - Format: `local@domain.tld`
 * - Max length: 254 characters (RFC 5321)
 * - Normalized: lowercase, whitespace trimmed
 * - Used: Login, Signup, Profile updates
 *
 * ### Password
 * - Min length: 8 characters
 * - Required: 1 uppercase (A-Z)
 * - Required: 1 lowercase (a-z)
 * - Required: 1 digit (0-9)
 * - Required: 1 special char (!@#$%^&*)
 * - Whitespace: Leading/trailing trimmed (internal allowed)
 * - Used: Signup only (login doesn't re-validate strength)
 *
 * ### Username
 * - Min length: 3 characters
 * - Max length: 50 characters
 * - Allowed chars: a-z, A-Z, 0-9, -, _
 * - Whitespace: Trimmed
 * - Used: Signup only
 *
 * ## Architecture
 *
 * ### Validation Flow
 *
 * ```
 * Frontend Input
 *   ↓
 * Frontend Validation (UX feedback)
 *   ↓
 * Send to Backend (if valid)
 *   ↓
 * Validation Middleware (double-check)
 *   ↓
 * Normalize Values
 *   ↓
 * Pass to Controller (req.validated)
 *   ↓
 * Business Logic (auth, DB queries, etc)
 * ```
 *
 * **Key Principle**: Backend is source of truth. Never trust frontend validation.
 *
 * ### File Structure
 *
 * ```
 * client/src/utils/validation.ts           ← Shared validation logic
 * client/src/pages/LoginPage.tsx           ← Uses validation
 * client/src/pages/RegisterPage.tsx        ← Uses validation + password strength UI
 *
 * src/utils/validation.ts                  ← Same logic as frontend
 * src/middleware/validationMiddleware.ts   ← Express middleware
 * src/routes/authRoutes.ts                 ← Uses middleware
 * src/controllers/authController.ts        ← Uses validated data
 *
 * tests/validation.test.ts                 ← Unit tests
 * tests/auth.validation.test.ts            ← Integration tests
 * ```
 *
 * ## Extending the Validation
 *
 * ### Add a New Validation Rule
 *
 * 1. **Add to utils/validation.ts** (both client and server):
 *
 * ```typescript
 * export function validateNewField(value: string) {
 *   return {
 *     valid: value.length > 0,
 *     error: 'Field is required'
 *   };
 * }
 * ```
 *
 * 2. **Use in middleware** (backend):
 *
 * ```typescript
 * const newValidation = validateNewField(req.body.newField);
 * if (!newValidation.valid) {
 *   errors.newField = newValidation.error;
 * }
 * ```
 *
 * 3. **Add tests**:
 *
 * ```typescript
 * describe('New Field Validation', () => {
 *   it('should reject empty field', () => {
 *     const result = validateNewField('');
 *     expect(result.valid).toBe(false);
 *   });
 * });
 * ```
 *
 * ### Change Password Policy
 *
 * To strengthen or relax password requirements:
 *
 * ```typescript
 * // In src/utils/validation.ts + client/src/utils/validation.ts
 *
 * // Example: Require 10 chars instead of 8
 * export const PASSWORD_MIN_LENGTH = 10;
 *
 * // Example: Add new requirement
 * hasConsecutiveChars: /(.)\1/.test(password), // Reject "aabbcc"
 * ```
 *
 * **Important**: Update tests when changing policy!
 *
 * ### Update Error Messages
 *
 * Error messages are in the validation functions. To update:
 *
 * ```typescript
 * // client/src/utils/validation.ts
 * // src/utils/validation.ts
 *
 * if (!requirements.minLength) {
 *   errors.push(`Minimum ${PASSWORD_MIN_LENGTH} characters (you have ${password.length})`);
 * }
 * ```
 *
 * ## Testing
 *
 * ### Unit Tests
 *
 * Test validation functions in isolation:
 *
 * ```bash
 * npm test -- tests/validation.test.ts
 * ```
 *
 * Example:
 * ```typescript
 * it('should accept strong password', () => {
 *   const result = validatePassword('StrongPass123!');
 *   expect(result.valid).toBe(true);
 *   expect(result.errors).toHaveLength(0);
 * });
 * ```
 *
 * ### Integration Tests
 *
 * Test auth endpoints with validation:
 *
 * ```bash
 * npm test -- tests/auth.validation.test.ts\n * ```
 *
n * Example:\n * ```typescript\n * it('should reject weak password', async () => {\n *   const response = await request(app)\n *     .post('/api/auth/register')\n *     .send({\n *       username: 'testuser',\n *       email: 'test@example.com',\n *       password: 'weak'\n *     });\n *\n *   expect(response.status).toBe(400);\n *   expect(response.body.errors.password.length).toBeGreaterThan(0);\n * });\n * ```\n *\n * ## Common Issues & Fixes\n *\n * ### Issue: Client validation passes but server rejects\n * **Cause**: Client and server validation logic differs\n * **Fix**: Keep both in sync. Consider auto-syncing validation logic.\n *\n * ### Issue: User complains about complex password requirement\n * **Solution**: Make password visually clearer in RegisterPage with real-time feedback\n *\n * ### Issue: Email validation too strict/loose\n * **Note**: Current regex `^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$` is intentionally permissive.\n * For stricter validation, consider RFC 5322 library.\n *\n * ## Performance Considerations\n *\n * - Validation is fast (regex + string operations)\n * - No async calls in validation functions\n * - Debounce password strength checks on frontend if typing fast\n * - Backend validation adds minimal latency\n *\n * ## Security Checklist\n *\n * - [ ] Never log passwords\n * - [ ] Always validate on backend (don't trust frontend)\n * - [ ] Use generic error messages for login failures\n * - [ ] Hash passwords with bcrypt (10+ rounds)\n * - [ ] Implement rate limiting on auth endpoints\n * - [ ] Use HTTPS only (no plaintext auth)\n * - [ ] Validate and normalize email (prevent duplicates)\n * - [ ] Test with SQLi/NoSQLi payloads in validation\n *\n * ## Future Improvements\n *\n * - [ ] Add rate limiting to prevent brute force\n * - [ ] Add CAPTCHA on repeated failed attempts\n * - [ ] Add password breach check (Have I Been Pwned API)\n * - [ ] Add two-factor authentication (2FA)\n * - [ ] Add email verification on signup\n * - [ ] Add password reset flow\n * - [ ] Consider RFC 5322 compliant email validation\n * - [ ] Add internationalization for error messages\n */\n