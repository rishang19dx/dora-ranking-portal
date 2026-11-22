import React, { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldWarning } from '@phosphor-icons/react';
import { authService } from '../../services/api';
import { hasRole, homeFor, roleOf, ROLE_LABELS, type PortalRole } from '../../lib/rbac';

interface RequireRoleProps {
  roles: PortalRole[];
  children?: React.ReactNode;
}

/**
 * Route guard. Without a session it sends the visitor to the login dialog on
 * the public portal (returning them here afterwards); with the wrong role it
 * explains why instead of rendering a page whose API calls would all be
 * refused.
 *
 * The role in localStorage is only a hint for the UI. It is re-read from
 * `/api/auth/me/` on entry so a role changed by an admin takes effect, and a
 * session the server no longer accepts is ended.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const token = localStorage.getItem('dora_access_token');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authService.fetchMe()
      .then((fresh) => { if (!cancelled) setUser(fresh); })
      .catch((err) => {
        if (cancelled) return;
        // Only a definite rejection ends the session; a network blip does not.
        if (err?.response?.status === 401) {
          authService.logout();
          navigate(`/?login=1&next=${encodeURIComponent(location.pathname)}`, { replace: true });
        }
      });
    return () => { cancelled = true; };
    // Re-verify when the session changes, not on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token || !user) {
    return <Navigate to={`/?login=1&next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!hasRole(user, roles)) {
    const role = roleOf(user);
    return (
      <div className="max-w-xl mx-auto mt-16 bg-white border border-slate-200/60 rounded-3xl p-10 text-center shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-dusty-rose-50 text-dusty-rose-600 flex items-center justify-center">
          <ShieldWarning weight="duotone" className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-900">Not available for your role</h2>
        <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
          You are signed in as <strong>{role ? ROLE_LABELS[role] : 'an unrecognised role'}</strong>.
          This page is limited to {roles.map((r) => ROLE_LABELS[r]).join(', ')}.
        </p>
        <Link
          to={homeFor(user)}
          className="inline-block mt-6 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-black"
        >
          Go to my dashboard
        </Link>
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}

/** Renders its children only for roles that may change data (Admin). */
export function WriteOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const user = authService.getCurrentUser();
  return <>{roleOf(user) === 'ADMIN' ? children : fallback}</>;
}
