/** Domain types shared by the admin UI, the API routes and the restricted portal. */

import type { RankingFramework } from './data-catalogue';

export type OfficerStatus = 'INVITED' | 'ACTIVE' | 'REVOKED';

export interface NodalOfficer {
  id: string;
  name: string;
  designation?: string;
  email: string;
  phone?: string;
  /** Organogram sections this officer is the nodal contact for. */
  unitIds: string[];
  status: OfficerStatus;
  createdAt: string;
  updatedAt: string;
  lastInvitedAt?: string;
  notes?: string;
}

export type RequestStatus = 'DISPATCHED' | 'CLOSED';

export type TargetStatus = 'PENDING' | 'PARTIAL' | 'SUBMITTED';

export interface DataRequestTarget {
  unitId: string;
  officerIds: string[];
  /** Items this section was actually asked for (intersection with its scopes). */
  dataItemIds: string[];
  status: TargetStatus;
  remindersSent: number;
  lastReminderAt?: string;
  submittedAt?: string;
}

export type DeliveryStatus = 'SENT' | 'SIMULATED' | 'FAILED';

export interface DeliveryRecord {
  id: string;
  officerId: string;
  officerName: string;
  unitId: string;
  email: string;
  subject: string;
  status: DeliveryStatus;
  error?: string;
  sentAt: string;
  /** Restricted portal link provisioned for this recipient. */
  portalPath?: string;
  kind: 'DISPATCH' | 'REMINDER';
}

export interface DataRequest {
  id: string;
  reference: string;
  title: string;
  framework: RankingFramework;
  cycleYear: number;
  subject: string;
  message: string;
  deadline: string;
  dataItemIds: string[];
  targets: DataRequestTarget[];
  deliveries: DeliveryRecord[];
  status: RequestStatus;
  createdBy: string;
  createdAt: string;
  dispatchedAt: string;
}

export interface AccessGrant {
  id: string;
  /** SHA-256 of the issued token - the raw token is never persisted. */
  tokenHash: string;
  officerId: string;
  requestId: string;
  unitId: string;
  dataItemIds: string[];
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
  useCount: number;
}

export interface ProofUpload {
  id: string;
  requestId: string;
  grantId: string;
  officerId: string;
  unitId: string;
  dataItemId: string;
  fileName: string;
  storedName: string;
  size: number;
  contentType: string;
  checksum: string;
  note?: string;
  uploadedAt: string;
}

export interface PortalStore {
  officers: NodalOfficer[];
  requests: DataRequest[];
  grants: AccessGrant[];
  uploads: ProofUpload[];
  sequence: number;
}

/** Shape returned to the admin UI for the organogram coverage view. */
export interface UnitCoverage {
  unitId: string;
  officerIds: string[];
  openRequests: number;
  pendingRequests: number;
  lastRequestedAt?: string;
}
