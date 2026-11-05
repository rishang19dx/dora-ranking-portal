export type RankingStatus = "Draft" | "Submitted" | "Under Review" | "Verified" | "Published";

export type UserRole = "Super Admin" | "Ranking Admin" | "Data Entry Operator" | "Viewer" | "ADMIN" | "NODAL_OFFICER";

export interface User {
  id: string | number;
  name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  department?: string;
  phone?: string;
}

export interface RankingAgency {
  id: string;
  name: string;
  short_name: string;
  logo: string;
  website: string;
  description: string;
  active: boolean;
}

export interface RankingCategory {
  id: string;
  agency_id: string;
  category_name: string;
  description: string;
  active: boolean;
}

export interface RankingItem {
  id: string;
  agency_id: string;
  agency_name: string;
  ranking_name: string;
  category: string;
  year: number;
  rank: number | string;
  previous_rank?: number | string;
  total_institutions?: number;
  score?: number;
  percentile?: number;
  status: RankingStatus;
  verified: boolean;
  source_url?: string;
  source_document?: string;
  methodology_notes?: string;
  remarks?: string;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  reviewed_by?: string;
  verified_by?: string;
  verification_date?: string;
}

export interface RankingParameter {
  id: string;
  ranking_id: string;
  parameter_name: string;
  score: number;
  maximum_score: number;
  percentage: number;
  remarks?: string;
}

export interface ParameterScore {
  id: string;
  ranking_id: string;
  code: string;
  name: string;
  max_score: number;
  score: number;
  weight: number;
  category: string;
  trend?: "up" | "down" | "stable";
}

export interface RankingDocument {
  id: string;
  ranking_id?: string;
  document_name: string;
  document_type: "NIRF Reports" | "QS Reports" | "THE Reports" | "India Today Reports" | "Institutional Data" | "Ranking Submissions" | "Supporting Documents" | "Press Releases";
  file_url: string;
  publication_date: string;
  uploaded_by: string;
  verified: boolean;
  file_size?: string;
}

export interface NewsUpdate {
  id: string;
  title: string;
  short_description: string;
  full_content: string;
  date: string;
  related_ranking_id?: string;
  image_url?: string;
  published: boolean;
}

export interface ComparativeData {
  id: string;
  institute_name: string;
  ranking_name: string;
  category_name: string;
  agency_name: string;
  year: number;
  rank: number;
  score: number;
  teaching: number;
  research: number;
  graduation_outcomes: number;
  outreach: number;
  perception: number;
  faculty_student_ratio?: string;
  citations?: string;
  research_output?: string;
  is_target?: boolean;
}

export interface AuditLog {
  id: string;
  user: string;
  role: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  old_value?: string;
  new_value?: string;
  timestamp: string;
  ip_address?: string;
}

export interface ActivityLog {
  id: string;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  details?: string;
  timestamp: string;
  ip_address?: string;
}

export interface DocumentProof {
  id: string;
  ranking_id: string;
  ranking_name: string;
  category: string;
  title: string;
  file_name: string;
  file_size: string;
  file_type: "pdf" | "xlsx" | "csv" | "docx";
  uploaded_by: string;
  uploaded_at: string;
  verified: boolean;
  notes?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  source_url?: string;
  published_date: string;
  agency_id?: string;
  category: "NIRF" | "QS" | "THE" | "General";
  featured?: boolean;
}

export interface YearFilter {
  label: string;
  value: number | "all";
}

export interface MetricCardData {
  title: string;
  value: string | number;
  previousValue?: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  subtitle: string;
  badge?: string;
  icon: string;
}

export interface PortalStats {
  totalAgencies: number;
  totalCategories: number;
  totalRankings: number;
  publishedRankings: number;
  improvedCount: number;
  declinedCount: number;
  bestRank: string;
  highlights: {
    bestNational?: RankingItem;
    bestEngineering?: RankingItem;
    bestInternational?: RankingItem;
    highestImprovement?: RankingItem;
  };
  lastUpdated: string;
}

export type ViewTab = 
  | "dashboard"
  | "rankings"
  | "agencies"
  | "trends"
  | "categories"
  | "parameters"
  | "documents"
  | "comparative"
  | "news"
  | "about"
  | "admin";

export type ActiveTab =
  | "overview"
  | "rankings"
  | "trends"
  | "agencies"
  | "categories"
  | "parameters"
  | "documents"
  | "comparative"
  | "news"
  | "about"
  | "admin";

// Re-export domain modules
export * from './lib/types';
export * from './lib/data-catalogue';
export * from './lib/organogram';

export interface NirfRankItem {
  institute_id: string;
  name: string;
  city: string;
  state: string;
  score: number | null;
  rank: number | string;
}

export interface MandiYearlyTrend {
  year: number;
  rank: number | string;
  score: number | null;
  previous_rank?: number | string | null;
  rank_change?: number;
  parameters?: {
    tlr: number;
    rpc: number;
    go: number;
    oi: number;
    pr: number;
  };
  city?: string;
  state?: string;
}

export interface PeerInstituteTrend {
  institute: string;
  short_name: string;
  is_target: boolean;
  ranks: Record<string, number | string>;
  scores: Record<string, number | null>;
  latest_rank: number | string | null;
  latest_score: number | null;
}

export interface TrendsApiResponse {
  years: number[];
  categories: string[];
  target_institute: string;
  iit_mandi_trends: Record<string, MandiYearlyTrend[]>;
  peer_comparison: Record<string, PeerInstituteTrend[]>;
}

export interface PortalContext {
  grant: {
    id: string;
    officerId: string;
    requestId: string;
    orgUnitId: string;
    dataItemIds: string[];
    expiresAt: string;
    revokedAt?: string;
    lastUsedAt?: string;
    useCount: number;
    createdAt: string;
  };
  request: {
    id: string;
    reference: string;
    title: string;
    framework: string;
    cycleYear: number;
    deadline: string;
    subject: string;
    message: string;
  };
  orgUnit: any;
  officer: any;
  allowedDataItems: string[];
  uploads: any[];
}
