import { api } from './api';

export interface Gate {
  key: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  summary: string;
  evidence: Record<string, unknown>;
}

export interface Kpi {
  key: string;
  label: string;
  passed: boolean;
  value: number | null;
  target: number | { rpoHours: number; rtoHours: number };
  summary: string;
  evidence: Record<string, unknown>;
}

export interface SignOffBrief {
  id: string;
  decision: 'APPROVE' | 'REJECT';
  signatoryName: string;
  designation: string;
  at: string;
}

export interface Readiness {
  generatedAt: string;
  appVersion: string;
  pilot: { id: string; name: string; status: PilotStatus } | null;
  kpis: { pilotId: string | null; allPassed: boolean; kpis: Kpi[] };
  gates: Gate[];
  recommendation: 'GO' | 'NO_GO';
  blockingFailures: string[];
  decision: SignOffBrief | null;
  handover: SignOffBrief | null;
}

export type PilotStatus = 'PLANNED' | 'RUNNING' | 'COMPLETED';

export interface Pilot {
  id: string;
  name: string;
  cycleYear: number;
  status: PilotStatus;
  units: { id: string; name: string }[];
  requests: { id: string; reference: string; title: string }[];
  startedAt: string | null;
  endedAt: string | null;
  notes: string;
}

export interface FlagReview {
  id: string;
  requestId: string;
  requestReference: string;
  checkId: string;
  severity: string;
  critical: boolean;
  systemFlagged: boolean;
  message: string;
  verdict: 'PENDING' | 'AGREE' | 'DISAGREE';
  comment: string;
  reviewer: string | null;
  reviewedAt: string | null;
}

export type UatResult = 'PASS' | 'FAIL' | 'BLOCKED';

export interface UatExecution {
  id: string;
  status: UatResult;
  testerName: string;
  notes: string;
  defectRef: string;
  executedAt: string;
}

export interface UatScenario {
  code: string;
  title: string;
  area: string;
  role: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
  steps: string[];
  expected: string;
  latest: UatExecution | null;
  history: UatExecution[];
}

export interface Drill {
  id: string;
  kind: 'AUTOMATED' | 'WITNESSED';
  backupName: string;
  failureDeclaredAt: string;
  rpoHours: number;
  rtoHours: number;
  integrityOk: boolean;
  meetsTargets: boolean;
  witnessedBy: string;
}

export interface BackupInfo {
  name: string;
  createdAt: string;
  size: number;
  hasChecksum: boolean;
}

export interface TrainingSession {
  id: string;
  title: string;
  audience: string;
  heldOn: string;
  trainer: string;
  attendees: number;
  materials: string;
}

export interface SignOff {
  id: string;
  kind: 'UAT' | 'GO_NO_GO' | 'HANDOVER';
  decision: 'APPROVE' | 'REJECT';
  signatoryName: string;
  designation: string;
  comment: string;
  recommendationAtSigning: 'GO' | 'NO_GO' | null;
  createdAt: string;
}

const base = '/api/golive';

export const goLiveService = {
  readiness: async (): Promise<Readiness> => (await api.get(`${base}/readiness/`)).data,

  pilots: async (): Promise<Pilot[]> => (await api.get(`${base}/pilots/`)).data,
  createPilot: async (body: { name: string; cycleYear: number; unitIds: string[]; requestIds: string[] }): Promise<Pilot> =>
    (await api.post(`${base}/pilots/`, body)).data,
  setPilotStatus: async (id: string, status: PilotStatus): Promise<Pilot> =>
    (await api.patch(`${base}/pilots/${id}/`, { status })).data,

  flagReviews: async (pilotId: string): Promise<FlagReview[]> =>
    (await api.get(`${base}/pilots/${pilotId}/flag-reviews/`)).data,
  syncFlags: async (pilotId: string, requestId: string): Promise<{ created: number; updated: number; reviews: FlagReview[] }> =>
    (await api.post(`${base}/pilots/${pilotId}/flag-reviews/`, { requestId })).data,
  reviewFlag: async (id: string, verdict: 'AGREE' | 'DISAGREE', comment = ''): Promise<FlagReview> =>
    (await api.patch(`${base}/flag-reviews/${id}/`, { verdict, comment })).data,

  uatScenarios: async (): Promise<UatScenario[]> => (await api.get(`${base}/uat/scenarios/`)).data,
  recordUat: async (code: string, body: { status: UatResult; notes?: string; defectRef?: string; testerName?: string }) =>
    (await api.post(`${base}/uat/scenarios/${code}/executions/`, body)).data as UatExecution,

  drills: async (): Promise<Drill[]> => (await api.get(`${base}/dr-drills/`)).data,
  backups: async (): Promise<BackupInfo[]> => (await api.get(`${base}/backups/`)).data,
  createBackup: async (label = 'manual') => (await api.post(`${base}/backups/`, { label })).data,

  training: async (): Promise<TrainingSession[]> => (await api.get(`${base}/training/`)).data,
  recordTraining: async (body: { title: string; audience: string; heldOn: string; trainer: string; attendees: number; materials?: string }) =>
    (await api.post(`${base}/training/`, body)).data as TrainingSession,

  signoffs: async (): Promise<SignOff[]> => (await api.get(`${base}/signoffs/`)).data,
  signOff: async (body: { kind: SignOff['kind']; decision: SignOff['decision']; signatoryName: string; designation: string; comment: string; pilotId?: string }) =>
    (await api.post(`${base}/signoffs/`, body)).data as SignOff,
};

export function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: { error?: string; detail?: string } } };
  if (e?.response?.status === 403) return 'Your role cannot make this change.';
  return e?.response?.data?.error ?? e?.response?.data?.detail ?? fallback;
}
