import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, MailCheck, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { isValidBangladeshPhone } from '../../../shared/bangladeshLocations.ts';
import { validateCustomerRegistrationInput } from '../../../shared/security.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import {
  closeAuthModal,
  fetchCurrentUser,
  openAuthModal,
  setAuthSession,
} from '../../features/auth/authSlice.ts';
import { mergeGuestCartOnLogin } from '../../features/cart/cartSlice.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { mergeGuestWishlistOnLogin } from '../../features/wishlist/wishlistSlice.ts';
import { apiRequest, setAuthToken } from '../../lib/api.ts';
import type { AuthUser } from '../../types/domain.ts';
import { Modal } from '../ui/Modal.tsx';

interface ProviderStatus {
  googleConfigured: boolean;
  facebookConfigured: boolean;
  emailConfigured?: boolean;
  smsConfigured?: boolean;
  requireEmailVerification?: boolean;
  needsSuperAdminBootstrap: boolean;
}

type FieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  termsAccepted?: string;
};

export function AuthModal() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { modalOpen, modalMode, returnTo } = useAppSelector((s) => s.auth);

  const [mode, setMode] = useState<'login' | 'register' | 'reset' | 'bootstrap'>(modalMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Verification pending state when requireEmailVerification is active or login hits EMAIL_UNVERIFIED
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);
  const [verificationPendingNotice, setVerificationPendingNotice] = useState<string>('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [providers, setProviders] = useState<ProviderStatus>({
    googleConfigured: false,
    facebookConfigured: false,
    needsSuperAdminBootstrap: false,
  });

  useEffect(() => {
    setMode(modalMode);
    setError(null);
    setFieldErrors({});
    setVerificationPendingEmail(null);
    setVerificationPendingNotice('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [modalMode, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    apiRequest<ProviderStatus>('/api/auth/providers')
      .then(setProviders)
      .catch(() => {});
  }, [modalOpen]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'NOVARA_OAUTH_SUCCESS') {
        if (event.data.token) setAuthToken(event.data.token);
        await dispatch(fetchCurrentUser());
        await Promise.all([
          dispatch(mergeGuestCartOnLogin()),
          dispatch(mergeGuestWishlistOnLogin()),
        ]);
        dispatch(closeAuthModal());
        dispatch(pushToast({ variant: 'success', message: 'Signed in successfully.' }));
        if (returnTo) navigate(returnTo);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [dispatch, navigate, returnTo]);

  const switchMode = (nextMode: 'login' | 'register' | 'reset' | 'bootstrap') => {
    setError(null);
    setFieldErrors({});
    setVerificationPendingEmail(null);
    setVerificationPendingNotice('');
    setMode(nextMode);
    if (nextMode === 'login' || nextMode === 'register' || nextMode === 'reset') {
      dispatch(openAuthModal({ mode: nextMode, returnTo: returnTo || undefined }));
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = (verificationPendingEmail || email).trim().toLowerCase();
    if (!targetEmail || resendCooldown > 0) return;
    setResendingEmail(true);
    setError(null);
    try {
      const res = await apiRequest<{ message: string; cooldownSeconds?: number; delivered?: boolean }>(
        '/api/auth/verify-email/resend',
        {
          method: 'POST',
          body: JSON.stringify({ email: targetEmail }),
        }
      );
      setResendCooldown(res.cooldownSeconds || 60);
      setVerificationPendingNotice(res.message);
      dispatch(
        pushToast({
          variant: res.delivered === false ? 'info' : 'success',
          message: res.message,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (mode === 'register') {
      const check = validateCustomerRegistrationInput(
        {
          name,
          email,
          phone,
          password,
          confirmPassword,
          termsAccepted,
        },
        isValidBangladeshPhone
      );
      if (!check.valid) {
        setFieldErrors(check.errors);
        setError(Object.values(check.errors).find(Boolean) || 'Please review the highlighted fields.');
        return;
      }
    }

    setSubmitting(true);

    try {
      if (mode === 'reset') {
        const res = await apiRequest<{ message: string }>('/api/auth/password-reset/request', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        dispatch(pushToast({ variant: 'info', message: res.message }));
        switchMode('login');
        return;
      }

      const endpoint =
        mode === 'login'
          ? '/api/auth/login'
          : mode === 'bootstrap'
          ? '/api/auth/bootstrap-admin'
          : '/api/auth/register';

      const body =
        mode === 'login'
          ? { email, password }
          : mode === 'bootstrap'
          ? { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, password }
          : {
              name: name.trim(),
              email: email.trim(),
              phone: phone.trim(),
              password,
              confirmPassword,
              termsAccepted,
            };

      const res = await apiRequest<{
        token?: string;
        user: AuthUser;
        requiresEmailVerification?: boolean;
        verificationEmailSent?: boolean;
        message?: string;
      }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (res.requiresEmailVerification || !res.token) {
        setVerificationPendingEmail(res.user.email);
        setVerificationPendingNotice(
          res.message ||
            'Please check your inbox and click the verification link before signing in.'
        );
        setResendCooldown(60);
        dispatch(
          pushToast({
            variant: 'info',
            message: res.message || 'Account created. Please verify your email address.',
          })
        );
        return;
      }

      dispatch(setAuthSession({ user: res.user, token: res.token }));
      await Promise.all([
        dispatch(mergeGuestCartOnLogin()),
        dispatch(mergeGuestWishlistOnLogin()),
      ]);
      dispatch(closeAuthModal());
      dispatch(
        pushToast({
          variant: 'success',
          message:
            mode === 'bootstrap'
              ? 'Super Admin account initialized.'
              : mode === 'register'
              ? res.verificationEmailSent
                ? 'Welcome to NOVARA COMMERCE! Check your inbox to verify your email.'
                : 'Welcome to NOVARA COMMERCE!'
              : `Welcome back, ${res.user.name}!`,
        })
      );

      if (returnTo) {
        navigate(returnTo);
      }
    } catch (err) {
      const apiErr = err as Error & { code?: string };
      if (apiErr.code === 'EMAIL_UNVERIFIED') {
        setVerificationPendingEmail(email.trim().toLowerCase());
        setVerificationPendingNotice(apiErr.message);
      }
      setError(apiErr.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuthPopup = async (provider: 'google' | 'facebook') => {
    setError(null);
    try {
      const res = await apiRequest<{ url: string }>(`/api/auth/oauth/${provider}/url`);
      const popup = window.open(res.url, `novara_${provider}_oauth`, 'width=560,height=680');
      if (!popup) {
        setError('Popup was blocked by your browser. Please allow popups and try again.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `${provider} sign-in is not configured in this environment.`
      );
    }
  };

  const titles = {
    login: 'Sign in to NOVARA COMMERCE',
    register: 'Create Your Customer Account',
    reset: 'Reset Your Password',
    bootstrap: 'Initialize First-Run Super Admin',
  };

  return (
    <Modal
      open={modalOpen}
      onClose={() => dispatch(closeAuthModal())}
      title={verificationPendingEmail ? 'Verify Your Email Address' : titles[mode]}
      description={
        !verificationPendingEmail && returnTo === '/checkout'
          ? 'Customer account sign-in is required before placing an order.'
          : undefined
      }
    >
      {(mode === 'login' || mode === 'register') && !verificationPendingEmail && (
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="grid grid-cols-2 gap-1.5 p-1 mb-4 rounded-xl bg-slate-100 border border-slate-200/70"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => switchMode('login')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              mode === 'login'
                ? 'bg-[#16A34A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => switchMode('register')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              mode === 'register'
                ? 'bg-[#16A34A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2"
        >
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {verificationPendingEmail ? (
        <div className="space-y-4 py-2 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-[#16A34A] flex items-center justify-center mx-auto">
            <MailCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-slate-900">{verificationPendingEmail}</p>
            <p className="text-xs text-slate-600 leading-relaxed">{verificationPendingNotice}</p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              disabled={resendingEmail || resendCooldown > 0}
              onClick={handleResendVerification}
              className="w-full py-2.5 px-4 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {resendingEmail && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {resendCooldown > 0
                  ? `Resend Verification Email (${resendCooldown}s)`
                  : 'Resend Verification Email'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVerificationPendingEmail(null);
                switchMode('login');
              }}
              className="w-full py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate={mode === 'register'}>
            {(mode === 'register' || mode === 'bootstrap') && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
                  }}
                  placeholder="e.g. Mahim Hasan"
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    fieldErrors.name
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-slate-200 focus:border-emerald-600'
                  }`}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.name}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                }}
                placeholder="you@example.com"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                  fieldErrors.email
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-200 focus:border-emerald-600'
                }`}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {(mode === 'register' || mode === 'bootstrap') && (
              <div>
                <label htmlFor="auth-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number {mode === 'bootstrap' ? '(optional)' : '(Bangladesh +880)'}
                </label>
                <input
                  id="auth-phone"
                  type="tel"
                  required={mode === 'register'}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) setFieldErrors((f) => ({ ...f, phone: undefined }));
                  }}
                  placeholder="+880 17XX-XXXXXX"
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    fieldErrors.phone
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-slate-200 focus:border-emerald-600'
                  }`}
                />
                {fieldErrors.phone && (
                  <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.phone}</p>
                )}
              </div>
            )}

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-xs text-emerald-700 hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'login' ? 1 : 8}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
                    }}
                    placeholder={mode === 'login' ? 'Enter your password' : 'Minimum 8 characters'}
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      fieldErrors.password
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-emerald-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.password}</p>
                )}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((f) => ({ ...f, confirmPassword: undefined }));
                      }
                    }}
                    placeholder="Re-enter your password"
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      fieldErrors.confirmPassword
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-emerald-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-[11px] font-medium text-red-600">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1">
                <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    id="auth-terms"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      if (fieldErrors.termsAccepted) {
                        setFieldErrors((f) => ({ ...f, termsAccepted: undefined }));
                      }
                    }}
                    className="mt-0.5 rounded border-slate-300 text-[#16A34A] focus:ring-[#16A34A]"
                  />
                  <span>
                    I agree to the{' '}
                    <Link
                      to="/policies/terms"
                      onClick={() => dispatch(closeAuthModal())}
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      Terms & Conditions
                    </Link>{' '}
                    and{' '}
                    <Link
                      to="/policies/privacy"
                      onClick={() => dispatch(closeAuthModal())}
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {fieldErrors.termsAccepted && (
                  <p className="text-[11px] font-medium text-red-600">{fieldErrors.termsAccepted}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                  ? 'Create Account'
                  : mode === 'bootstrap'
                  ? 'Claim Super Admin Account'
                  : 'Send Reset Link'}
              </span>
            </button>
          </form>

          {(mode === 'login' || mode === 'register') && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                <div className="flex-1 h-px bg-slate-200" />
                <span>OR CONTINUE WITH</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleOAuthPopup('google')}
                  className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                    providers.googleConfigured
                      ? 'border-slate-200 hover:bg-slate-50 text-slate-800'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  Google {providers.googleConfigured ? '' : '(Setup Required)'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuthPopup('facebook')}
                  className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                    providers.facebookConfigured
                      ? 'border-slate-200 hover:bg-slate-50 text-slate-800'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  Facebook {providers.facebookConfigured ? '' : '(Setup Required)'}
                </button>
              </div>
            </>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            {mode === 'login' ? (
              <span>
                New to NOVARA?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  Create Account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  Sign In
                </button>
              </span>
            )}

            {providers.needsSuperAdminBootstrap && mode !== 'bootstrap' && (
              <button
                type="button"
                onClick={() => switchMode('bootstrap')}
                className="text-amber-700 font-semibold hover:underline"
              >
                Claim First-Run Super Admin
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
