import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, normalizeEmail } from '../../../shared/validation';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { FormError } from '../components/ui/FormError';
import { SocialAuthButtons } from '../components/ui/SocialAuthButtons';
import styles from './AuthPage.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    
    if (!email) {
      e.email = 'Email is required';
    } else {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        e.email = emailValidation.error;
      }
    }
    
    if (!password) {
      e.password = 'Password is required';
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
      await login({ email: normalizeEmail(email), password, rememberMe });
      navigate('/profile');
    } catch (err: unknown) {
      const response = err as { response?: { data?: { message?: string; errors?: Record<string, string> } } };
      const msg = response?.response?.data?.message ?? 'Login failed. Please try again.';
      setFormError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome</h1>
        <p className={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <FormError message={formError} />
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFormError(''); // Clear form error when user edits
            }}
            error={errors.email}
            placeholder="you@example.com"
          />
          <Input
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFormError(''); // Clear form error when user edits
            }}
            error={errors.password}
            placeholder="••••••••"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="rememberMe" style={{ cursor: 'pointer', fontSize: '14px' }}>
              Remember me
            </label>
          </div>
          <Button type="submit" isLoading={isLoading} disabled={isLoading}>
            Sign in
          </Button>
        </form>

        <SocialAuthButtons />

        <p className={styles.link}>
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
