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
import NodalOfficerPortal from './views/nodal-officer/NodalOfficerPortal';
import NodalOfficerSubmission from './views/nodal-officer/NodalOfficerSubmission';
import RestrictedPortalPage from './views/portal/RestrictedPortalPage';
import { RankingsView } from './views/RankingsView';
import { DocumentsView } from './views/DocumentsView';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Landing View */}
      <Route path="/" element={<PublicLanding />} />

      {/* Restricted Token Upload Portal (Login-free single-purpose grant) */}
      <Route path="/portal/:token" element={<RestrictedPortalPage />} />

      {/* Protected Admin Suite */}
      <Route path="/admin" element={<DashboardLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="organogram" element={<AdminOrganogram />} />
        <Route path="nodal-officers" element={<AdminNodalOfficers />} />
        <Route path="data-collection" element={<AdminDataCollection />} />
        <Route path="data-requests/new" element={<AdminDataRequestComposer />} />
        <Route path="data-requests/:id" element={<AdminDataRequestDetail />} />
        <Route path="rankings" element={<div className="max-w-[1400px] mx-auto"><RankingsView /></div>} />
        <Route path="documents" element={<div className="max-w-[1400px] mx-auto"><DocumentsView documents={[]} onSelectDocument={() => {}} /></div>} />
        <Route path="settings" element={
          <div className="max-w-[1400px] mx-auto p-8 bg-white border border-slate-200/50 rounded-2xl">
            <h2 className="text-xl font-bold font-serif mb-2">Portal Configuration</h2>
            <p className="text-sm text-zinc-500">Settings managed via Django REST Framework & environment variables.</p>
          </div>
        } />
      </Route>

      {/* Protected Nodal Officer Suite */}
      <Route path="/nodal-officer" element={<DashboardLayout />}>
        <Route index element={<NodalOfficerPortal />} />
        <Route path="submissions/new" element={<NodalOfficerSubmission />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
