import React, { useState } from "react";
import { X, Lock, UserCheck, AlertCircle } from "lucide-react";
import { authService } from "../services/api";
import type { User } from "../types";

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

/**
 * Real sign-in against `/api/auth/token/`. The role comes from the account on
 * the server, never from a choice made in this dialog: the previous version
 * let the visitor pick "Super Admin" and then always signed in as the
 * built-in admin, whatever was typed.
 */
export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLoginSuccess }) => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await authService.login(login.trim(), password);
      onLoginSuccess(data.user);
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? "Incorrect username/email or password, or the account is deactivated."
          : status === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Could not reach the server. Check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
        <div className="bg-[#003366] text-white p-5 relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 text-blue-200 hover:text-white bg-blue-900/60 p-1.5 rounded-full hover:bg-blue-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-5 h-5 text-[#F58220]" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Institutional Access Control
            </span>
          </div>
          <h2 id="login-title" className="text-xl font-bold font-serif">
            IIT Mandi Ranking Portal Login
          </h2>
          <p className="text-xs text-blue-200 mt-0.5">
            DORA staff, leadership, auditors and nodal officers. Your access follows the role on your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="login-id" className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Username or institutional email
            </label>
            <input
              id="login-id"
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoFocus
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#003366] hover:bg-blue-900 disabled:opacity-60 text-white font-bold text-xs py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>{submitting ? "Signing in…" : "Sign in"}</span>
          </button>
          <p className="text-[11px] text-gray-500 text-center">
            Nodal officers without an account submit through the secure link in their request email.
          </p>
        </form>
      </div>
    </div>
  );
};
