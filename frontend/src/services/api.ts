import axios from 'axios';
import type {
  OrgUnit,
  NodalOfficer,
  DataRequest,
  DataItem,
  ParameterGroup,
  PortalContext,
  ProofUpload,
  NirfRankItem,
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

export const nodalOfficersService = {
  async list(): Promise<NodalOfficer[]> {
    const res = await api.get('/api/nodal-officers/');
    return res.data;
  },

  async create(data: Partial<NodalOfficer>): Promise<NodalOfficer> {
    const res = await api.post('/api/nodal-officers/', data);
    return res.data;
  },

  async update(id: string, data: Partial<NodalOfficer>): Promise<NodalOfficer> {
    const res = await api.patch(`/api/nodal-officers/${id}/`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/nodal-officers/${id}/`);
  },

  async getAccess(id: string) {
    const res = await api.get(`/api/nodal-officers/${id}/access/`);
    return res.data;
  },
};

export const dataRequestsService = {
  async list(): Promise<DataRequest[]> {
    const res = await api.get('/api/data-requests/');
    return res.data;
  },

  async get(id: string): Promise<DataRequest> {
    const res = await api.get(`/api/data-requests/${id}/`);
    return res.data;
  },

  async create(payload: {
    title: string;
    framework: string;
    cycleYear: number;
    subject: string;
    message: string;
    deadline: string;
    sections: { unitId: string; dataItemIds: string[] }[];
  }): Promise<DataRequest & { issuedGrants?: any[] }> {
    const res = await api.post('/api/data-requests/', payload);
    return res.data;
  },

  async action(id: string, action: 'remind' | 'close') {
    const res = await api.post(`/api/data-requests/${id}/actions/`, { action });
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

  async updateScraper(): Promise<{ message: string }> {
    const res = await api.post('/api/v1/scraper/update/');
    return res.data;
  },
};
