import axios from 'axios';
import type {
  AuditLogResponse,
  ProofRepositoryResponse,
  DepartmentAnalyticsResponse,
  GapAnalysisResponse,
  ParameterTrendsResponse,
  OrgUnit,
  NodalOfficer,
  DataRequest,
  DataItem,
  ParameterGroup,
  PortalContext,
  ProofUpload,
  NirfRankItem,
  TrendsApiResponse,
  User,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dora_access_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 refresh logic or redirect
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('dora_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, {
            refresh: refreshToken,
          });
          if (res.data.access) {
            localStorage.setItem('dora_access_token', res.data.access);
            originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
            return api(originalRequest);
          }
        } catch {
          localStorage.removeItem('dora_access_token');
          localStorage.removeItem('dora_refresh_token');
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async login(username: string, password: string) {
    const res = await api.post('/api/auth/token/', { username, password });
    if (res.data.access) {
      localStorage.setItem('dora_access_token', res.data.access);
      localStorage.setItem('dora_refresh_token', res.data.refresh);
      localStorage.setItem('dora_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },

  logout() {
    localStorage.removeItem('dora_access_token');
    localStorage.removeItem('dora_refresh_token');
    localStorage.removeItem('dora_user');
  },

  getCurrentUser(): User | null {
    const raw = localStorage.getItem('dora_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async fetchMe(): Promise<User> {
    const res = await api.get('/api/auth/me/');
    localStorage.setItem('dora_user', JSON.stringify(res.data));
    return res.data;
  },
};

export const organogramService = {
  async getOverview(): Promise<{
    tree: OrgUnit;
    units: OrgUnit[];
    catalogue: DataItem[];
    groups: Record<ParameterGroup, string>;
  }> {
    const res = await api.get('/api/organogram/');
    return res.data;
  },
};

export const nodalOfficerService = {
  async getAll(): Promise<NodalOfficer[]> {
    const res = await api.get('/api/nodal-officers/');
    return Array.isArray(res.data) ? res.data : (res.data.officers || []);
  },

  async getById(id: string): Promise<NodalOfficer> {
    const res = await api.get(`/api/nodal-officers/${id}/`);
    return res.data;
  },

  async create(data: Partial<NodalOfficer>): Promise<NodalOfficer> {
    const res = await api.post('/api/nodal-officers/', data);
    return res.data;
  },

  async update(id: string, data: Partial<NodalOfficer>): Promise<NodalOfficer> {
    const res = await api.put(`/api/nodal-officers/${id}/`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/nodal-officers/${id}/`);
  },

  async issueAccess(officerId: string, payload: { requestId: string; orgUnitId: string; dataItemIds: string[]; expiresInHours?: number }): Promise<{ token: string; url: string; expiresAt: string }> {
    const res = await api.post(`/api/nodal-officers/${officerId}/access/`, payload);
    return res.data;
  },
};

export const dataRequestService = {
  async getAll(params?: { status?: string; framework?: string }): Promise<DataRequest[]> {
    const res = await api.get('/api/data-requests/', { params });
    return res.data;
  },

  async getById(id: string): Promise<DataRequest> {
    const res = await api.get(`/api/data-requests/${id}/`);
    return res.data;
  },

  async create(data: any): Promise<DataRequest> {
    const res = await api.post('/api/data-requests/', data);
    return res.data;
  },

  async performAction(id: string, action: 'submit' | 'approve' | 'reject' | 'archive', payload?: any): Promise<DataRequest> {
    const res = await api.post(`/api/data-requests/${id}/actions/`, { action, ...payload });
    return res.data;
  },
};

export const portalService = {
  async getContext(token: string): Promise<PortalContext> {
    const res = await api.get(`/api/portal/${token}/`);
    return res.data;
  },

  async upload(token: string, file: File, dataItemId: string, note?: string): Promise<ProofUpload> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dataItemId', dataItemId);
    if (note) formData.append('note', note);

    const res = await api.post(`/api/portal/${token}/upload/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};

export const rankingsService = {
  async getRankings(year: number | string, category: string, params?: { state?: string; city?: string; limit?: number }): Promise<{ count: number; data: NirfRankItem[] }> {
    const res = await api.get(`/api/v1/rankings/${year}/${category}/`, { params });
    return res.data;
  },

  async getSecondGenIITs(year: number | string, category: string): Promise<{ count: number; data: NirfRankItem[] }> {
    const res = await api.get(`/api/v1/rankings/${year}/${category}/2nd-gen-iits/`);
    return res.data;
  },

  async getTrends(category?: string): Promise<TrendsApiResponse> {
    const res = await api.get('/api/v1/rankings/trends/', { params: category ? { category } : {} });
    return res.data;
  },

  /** Parameter-wise history (TLR/RPC/GO/OI/PR) over a selectable range. */
  async getParameterTrends(
    category?: string,
    range?: { last?: number; from?: number; to?: number },
  ): Promise<ParameterTrendsResponse> {
    const res = await api.get('/api/v1/rankings/parameters/trends/', {
      params: { ...(category ? { category } : {}), ...(range || {}) },
    });
    return res.data;
  },

  /** Gap analysis against peer IITs and against the institute's own history. */
  async getGapAnalysis(category?: string, year?: number): Promise<GapAnalysisResponse> {
    const res = await api.get('/api/v1/rankings/gap-analysis/', {
      params: { ...(category ? { category } : {}), ...(year ? { year } : {}) },
    });
    return res.data;
  },

  async updateScraper(): Promise<{ message: string }> {
    const res = await api.post('/api/v1/scraper/update/');
    return res.data;
  },
};


export const analyticsService = {
  /**
   * Department-wise contribution and performance for a cycle. The backend
   * scopes the result by role, so a department head receives only their own.
   */
  async getDepartmentAnalytics(
    cycleYear: number,
    params?: { requestId?: string; category?: string; unitId?: string },
  ): Promise<DepartmentAnalyticsResponse> {
    const res = await api.get(`/api/nirf/cycles/${cycleYear}/department-analytics/`, {
      params: params || {},
    });
    return res.data;
  },

  /** Downloads the boardroom briefing PDF. */
  async downloadBriefing(
    cycleYear: number,
    params?: { requestId?: string; category?: string; rankingYear?: number },
  ): Promise<void> {
    const res = await api.get(`/api/nirf/cycles/${cycleYear}/briefing/`, {
      params: params || {},
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DORA_Boardroom_Briefing_NIRF_${cycleYear}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export interface AuditLogFilters {
  action?: string;
  actorType?: string;
  sectionId?: string;
  unitId?: string;
  requestId?: string;
  cycleYear?: number;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

function compact(filters: AuditLogFilters): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  ) as Record<string, string | number>;
}

export const auditService = {
  /** Filterable, searchable audit trail (Admin, Director, Auditor). */
  async list(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
    const res = await api.get('/api/audit-log/', { params: compact(filters) });
    return res.data;
  },

  /** Downloads the filtered trail as CSV. The download is itself audited. */
  async exportCsv(filters: AuditLogFilters = {}): Promise<void> {
    const { page: _page, pageSize: _size, ...rest } = filters;
    const res = await api.get('/api/audit-log/', {
      params: { ...compact(rest), export: 'csv' },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DORA_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export interface ProofFilters {
  q?: string;
  sectionId?: string;
  unitId?: string;
  requestId?: string;
  dataItemId?: string;
  cycleYear?: number;
  latestOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export const proofService = {
  /** The searchable proof repository (Admin, Director, Auditor). */
  async list(filters: ProofFilters = {}): Promise<ProofRepositoryResponse> {
    const params: Record<string, string | number> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v === undefined || v === '' || v === null || v === false) return;
      params[k] = v === true ? 1 : (v as string | number);
    });
    const res = await api.get('/api/proofs/', { params });
    return res.data;
  },

  /**
   * Downloads one proof through the authenticated endpoint, which also
   * re-verifies the file against its stored SHA-256.
   */
  async download(id: string, fileName: string): Promise<void> {
    const res = await api.get(`/api/proofs/${id}/download/`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
