import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, validateUsername, normalizeEmail, normalizePassword, normalizeUsername } from '../../../src/shared/validation';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { FormError } from '../components/ui/FormError';
import { SocialAuthButtons } from '../components/ui/SocialAuthButtons';
import styles from './AuthPage.module.css';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string | string[];
  }>({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    
    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      e.username = usernameValidation.error;
    }
    
    // Validate email
    if (!email) {
      e.email = 'Email is required';
    } else {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        e.email = emailValidation.error;
      }
    }
    
    // Validate password
    if (!password) {
      e.password = 'Password is required';
    } else {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        e.password = passwordValidation.errors; // Array of requirement errors
      }
    }
    
    return e;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      await register({
        username: normalizeUsername(username),
        email: normalizeEmail(email),
        password: normalizePassword(password),
      });
      navigate('/profile');
    } catch (err: unknown) {
      const response = err as { response?: { data?: { message?: string; errors?: Record<string, string> } } };
      const msg = response?.response?.data?.message ?? 'Registration failed. Please try again.';
      setFormError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Get password validation result for real-time feedback
  const passwordValidation = password ? validatePassword(password) : null;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Join the recipe community</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <FormError message={formError} />
          <Input
            id="username"
            label="Username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setFormError(''); // Clear form error when user edits
            }}
            error={errors.username ? (typeof errors.username === 'string' ? errors.username : undefined) : undefined}
            placeholder="chef_master"
          />
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFormError(''); // Clear form error when user edits
            }}
            error={errors.email ? (typeof errors.email === 'string' ? errors.email : undefined) : undefined}
            placeholder="you@example.com"
          />
          <div>
            <Input
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFormError(''); // Clear form error when user edits
              }}
              error={
                errors.password
                  ? typeof errors.password === 'string'
                    ? errors.password
                    : errors.password[0]
                  : undefined
              }
              placeholder="Enter strong password"
            />
            {/* Password strength indicators */}
            {password && passwordValidation && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#666',
              }}>
                <p style={{ marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Password requirements:
                </p>
                <ul style={{ margin: '0', paddingLeft: '16px' }}>
                  <li style={{ color: passwordValidation.requirements.minLength ? '#10b981' : '#ef4444' }}>
                    ✓ At least 8 characters
                  </li>
                  <li style={{ color: passwordValidation.requirements.hasUppercase ? '#10b981' : '#ef4444' }}>
                    ✓ At least 1 uppercase letter (A-Z)
                  </li>
                  <li style={{ color: passwordValidation.requirements.hasLowercase ? '#10b981' : '#ef4444' }}>
                    ✓ At least 1 lowercase letter (a-z)
                  </li>
                  <li style={{ color: passwordValidation.requirements.hasNumber ? '#10b981' : '#ef4444' }}>
                    ✓ At least 1 number (0-9)
                  </li>
                  <li style={{ color: passwordValidation.requirements.hasSpecialChar ? '#10b981' : '#ef4444' }}>
                    ✓ At least 1 special character (!@#$%^&*)
                  </li>
                </ul>
              </div>
            )}
          </div>
          <Button type="submit" isLoading={isLoading} disabled={isLoading}>
            Create account
          </Button>
        </form>

        <SocialAuthButtons />

        <p className={styles.link}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
