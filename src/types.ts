export type RankingStatus = "Draft" | "Submitted" | "Under Review" | "Verified" | "Published";

export type UserRole = "Super Admin" | "Ranking Admin" | "Data Entry Operator" | "Viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
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
  rank: number;
  previous_rank?: number;
  total_institutions?: number;
  score?: number;
  percentile?: number;
  status: RankingStatus;
  verified: boolean;
  source_url?: string;
  source_document?: string;
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
  year: number;
  agency_name: string;
  category_name: string;
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
