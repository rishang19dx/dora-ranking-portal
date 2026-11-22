import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLanding from './views/PublicLanding';
import DashboardLayout from './components/DashboardLayout';
import AdminOverview from './views/admin/AdminOverview';
import AdminOrganogram from './views/admin/AdminOrganogram';
import AdminNodalOfficers from './views/admin/AdminNodalOfficers';
import AdminDataCollection from './views/admin/AdminDataCollection';
import AdminDataRequestComposer from './views/admin/AdminDataRequestComposer';
import AdminDataRequestDetail from './views/admin/AdminDataRequestDetail';
import AdminProgrammes from './views/admin/AdminProgrammes';
import AdminAuditLog from './views/admin/AdminAuditLog';
import AdminProofRepository from './views/admin/AdminProofRepository';
import AdminGoLive from './views/admin/AdminGoLive';
import NodalOfficerPortal from './views/nodal-officer/NodalOfficerPortal';
import NodalOfficerSubmission from './views/nodal-officer/NodalOfficerSubmission';
import NodalOfficerAnalytics from './views/nodal-officer/NodalOfficerAnalytics';
import RestrictedPortalPage from './views/portal/RestrictedPortalPage';
import { RankingsView } from './views/RankingsView';
import { DocumentsView } from './views/DocumentsView';
import RankingManagement from './views/RankingManagement';
import AdminUsers from './views/admin/AdminUsers';
import AdminReminders from './views/admin/AdminReminders';
import AdminDiscrepancies from './views/admin/AdminDiscrepancies';
import AdminPublicRankings from './views/admin/AdminPublicRankings';
import { RequireRole } from './components/auth/RequireRole';
import { ADMIN_ROUTE_ROLES, OVERSIGHT, type PortalRole } from './lib/rbac';

/** An admin page behind the role its route allows (see ADMIN_ROUTE_ROLES). */
function guard(path: string, element: React.ReactElement) {
  const roles: PortalRole[] = ADMIN_ROUTE_ROLES[path] ?? OVERSIGHT;
  return <RequireRole roles={roles}>{element}</RequireRole>;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Landing View */}
      <Route path="/" element={<PublicLanding />} />

      {/* Restricted Token Upload Portal (Login-free single-purpose grant) */}
      <Route path="/portal/:token" element={<RestrictedPortalPage />} />

      {/* Protected Admin Suite: Admin, Director (read-only), Auditor (read-only) */}
      <Route path="/admin" element={<RequireRole roles={OVERSIGHT}><DashboardLayout /></RequireRole>}>
        <Route index element={guard('', <AdminOverview />)} />
        <Route path="organogram" element={guard('organogram', <AdminOrganogram />)} />
        <Route path="nodal-officers" element={guard('nodal-officers', <AdminNodalOfficers />)} />
        <Route path="data-collection" element={guard('data-collection', <AdminDataCollection />)} />
        <Route path="programmes" element={guard('programmes', <AdminProgrammes />)} />
        <Route path="audit-log" element={guard('audit-log', <AdminAuditLog />)} />
        <Route path="proofs" element={guard('proofs', <AdminProofRepository />)} />
        <Route path="users" element={guard('users', <AdminUsers />)} />
        <Route path="reminders" element={guard('reminders', <AdminReminders />)} />
        <Route path="discrepancies" element={guard('discrepancies', <AdminDiscrepancies />)} />
        <Route path="public-rankings" element={guard('public-rankings', <AdminPublicRankings />)} />
        <Route path="go-live" element={guard('go-live', <AdminGoLive />)} />
        <Route path="ranking-records" element={guard('ranking-records', <RankingManagement />)} />
        <Route path="data-requests/new" element={guard('data-requests/new', <AdminDataRequestComposer />)} />
        <Route path="data-requests/:id" element={guard('data-requests/:id', <AdminDataRequestDetail />)} />
        <Route path="rankings" element={guard('rankings', <div className="max-w-[1400px] mx-auto"><RankingsView /></div>)} />
        <Route path="documents" element={guard('documents', <div className="max-w-[1400px] mx-auto"><DocumentsView documents={[]} onSelectDocument={() => {}} /></div>)} />
        <Route path="settings" element={guard('settings',
          <div className="max-w-[1400px] mx-auto p-8 bg-white border border-slate-200/50 rounded-2xl">
            <h2 className="text-xl font-bold font-serif mb-2">Portal Configuration</h2>
            <p className="text-sm text-zinc-500">Settings managed via Django REST Framework & environment variables.</p>
          </div>
        )} />
      </Route>

      {/* Department Nodal Officer Suite: their own department only */}
      <Route path="/nodal-officer" element={<RequireRole roles={['NODAL_OFFICER', 'ADMIN']}><DashboardLayout /></RequireRole>}>
        <Route index element={<NodalOfficerPortal />} />
        <Route path="submissions/new" element={<NodalOfficerSubmission />} />
        <Route path="analytics" element={<NodalOfficerAnalytics />} />
        <Route path="rankings" element={<RankingManagement />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
