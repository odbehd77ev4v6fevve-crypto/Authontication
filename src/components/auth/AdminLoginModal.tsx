import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isStaffRole, ROLE_METADATA } from '../../../shared/rbac.ts';
import { validateAdminLoginInput } from '../../../shared/security.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { closeAdminAuthModal, setAuthSession } from '../../features/auth/authSlice.ts';
import { syncServerCart } from '../../features/cart/cartSlice.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { AuthUser } from '../../types/domain.ts';
import { Modal } from '../ui/Modal.tsx';

export function AdminLoginModal() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { adminModalOpen, adminReturnTo, user } = useAppSelector((s) => s.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (!adminModalOpen) {
      setPassword('');
      setShowPassword(false);
      setErrorMsg(null);
      setFieldErrors({});
      setSubmitting(false);
    }
  }, [adminModalOpen]);

  const handleClose = () => {
    if (submitting) return;
    dispatch(closeAdminAuthModal());
  };

  const handleContinueToPanel = () => {
    const target = adminReturnTo || '/admin';
    dispatch(closeAdminAuthModal());
    navigate(target);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateAdminLoginInput({ email, password });
    setFieldErrors(validation.errors);
    if (!validation.valid) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: validation.email,
          password,
        }),
      });

      dispatch(setAuthSession({ user: res.user, token: res.token }));
      void dispatch(syncServerCart());
      const target = adminReturnTo || '/admin';
      dispatch(closeAdminAuthModal());
      dispatch(
        pushToast({
          variant: 'success',
          message: `Signed in to Admin Panel as ${res.user.name}.`,
        })
      );
      navigate(target);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to verify administrator credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyStaff = Boolean(user && isStaffRole(user.role));
  const staffRoleLabel = user ? ROLE_METADATA[user.role]?.label || user.role : '';

  return (
    <Modal
      open={adminModalOpen}
      onClose={handleClose}
      title="Admin Login"
      description="Sign in with an authorized administrator or operations staff account."
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-900 text-white px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide uppercase text-emerald-400">
              Restricted Access
            </p>
            <p className="text-xs text-slate-300 truncate">
              Protected by RBAC &amp; server-side session verification
            </p>
          </div>
        </div>

        {alreadyStaff && user && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-950 truncate">
                  Active session: {user.name}
                </p>
                <p className="text-[11px] text-emerald-700 truncate">
                  {user.email} · {staffRoleLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={handleContinueToPanel}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
              >
                <span>Open Panel</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-login-email" className="block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="name@company.com"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'admin-email-error' : undefined}
                className={`w-full h-11 pl-10 pr-3 rounded-xl border text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600/25 ${
                  fieldErrors.email
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-200 focus:border-emerald-600'
                }`}
              />
            </div>
            {fieldErrors.email && (
              <p id="admin-email-error" className="text-xs text-red-600 font-medium">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-login-password" className="block text-xs font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                placeholder="Enter your password"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined}
                className={`w-full h-11 pl-10 pr-11 rounded-xl border text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600/25 ${
                  fieldErrors.password
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-200 focus:border-emerald-600'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="admin-password-error" className="text-xs text-red-600 font-medium">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In to Admin</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
