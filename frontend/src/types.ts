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

// ---------------------------------------------------------------------------
// Phase 2 analytics (proposal Part D: 2.15 - 2.17)
// ---------------------------------------------------------------------------

export interface ParameterCell {
  key: string;
  label: string;
  value: number | null;
  weight: number;
  weightedContribution: number | null;
}

export interface ParameterTrendPoint {
  year: number;
  rank: number | string | null;
  score: number | null;
  parameters: Record<string, ParameterCell>;
  parameterDeltas: Record<string, number | null>;
  recomposedScore: number | null;
  hasParameters: boolean;
}

export interface ParameterTrendSeries {
  category: string;
  targetInstitute: string;
  weights: Record<string, number>;
  labels: Record<string, string>;
  series: ParameterTrendPoint[];
  netMovement: {
    fromYear: number;
    toYear: number;
    parameters: Record<string, number | null>;
  } | null;
}

export interface ParameterTrendsResponse {
  years: number[];
  availableYears: number[];
  categories: string[];
  parameterOrder: string[];
  labels: Record<string, string>;
  weights: Record<string, number>;
  trends: Record<string, ParameterTrendSeries>;
}

export interface PeerGapRow {
  key: string;
  label: string;
  weight: number;
  own: number | null;
  peerBest: number | null;
  peerBestInstitute: string | null;
  peerMedian: number | null;
  gapToBest: number | null;
  gapToMedian: number | null;
  weightedUpsideToBest: number | null;
  percentileAmongPeers: number | null;
  leadsPeers?: boolean;
}

export interface PeerStanding {
  institute: string;
  rank: number | string | null;
  score: number | null;
  isTarget: boolean;
  parameters: Record<string, number | null>;
}

export interface OwnHistoryRow {
  key: string;
  label: string;
  weight: number;
  own: number | null;
  historicalMean: number | null;
  historicalBest: number | null;
  historicalBestYear: number | null;
  deltaVsMean: number | null;
  deltaVsBest: number | null;
  weightedUpsideToOwnBest: number | null;
  belowOwnAverage: boolean | null;
}

export interface GapAnalysisEntry {
  vsPeers: {
    available: boolean;
    reason?: string;
    targetRank?: number | string | null;
    targetScore?: number | null;
    recomposedScore?: number | null;
    parameters: PeerGapRow[];
    priorities: Array<{
      key: string;
      label: string;
      gapToBest: number | null;
      weightedUpsideToBest: number | null;
      peerBestInstitute: string | null;
    }>;
    totalWeightedUpside?: number;
    peers: PeerStanding[];
  };
  vsOwnHistory: {
    available: boolean;
    reason?: string;
    comparedAgainstYears?: number[];
    parameters: OwnHistoryRow[];
    belowOwnAverage?: string[];
    regressions?: Array<{
      key: string;
      label: string;
      deltaVsBest: number | null;
      historicalBestYear: number | null;
      weightedUpsideToOwnBest: number | null;
    }>;
    totalWeightedUpsideToOwnBest?: number;
  };
  projections?: {
    available: boolean;
    reason?: string;
    baseScore?: number;
    disclaimer: string;
    scenarios: Array<{
      id: string;
      label: string;
      scoreDelta: number;
      projectedScore: number;
      wouldHaveRanked: number | null;
    }>;
  };
}

export interface GapAnalysisResponse {
  year: number;
  categories: string[];
  parameterOrder: string[];
  labels: Record<string, string>;
  weights: Record<string, number>;
  analysis: Record<string, GapAnalysisEntry>;
}

export interface DepartmentContribution {
  unitId: string;
  unitName: string;
  shortName: string | null;
  kind: string;
  researchFundingInr: number;
  sanctionedResearchInr: number;
  researchProjects: number;
  fundingAgencies: number;
  graduated: number;
  placed: number;
  higherStudies: number;
  phdGraduated: number;
  studentStrength: number;
  sanctionedIntake: number;
  placementRatePct: number | null;
  higherStudiesRatePct: number | null;
  outcomeRatePct: number | null;
  femaleSharePct: number | null;
  fundingPerStudentInr: number | null;
  fundingSharePct: number | null;
  sections: string[];
}

export interface DepartmentPerformance {
  unitId: string;
  unitName: string;
  shortName: string | null;
  kind: string;
  isAcademicUnit: boolean;
  expectedSections: number;
  sectionsTouched: number;
  submissions: number;
  approved: number;
  submittedAwaitingReview: number;
  draft: number;
  correctionRequested: number;
  notApplicable: number;
  completionPct: number;
  missingSections: string[];
  recordsContributed: number;
  correctionCycles: number;
  firstPassApprovalPct: number;
  avgReviewTurnaroundHours: number | null;
  remindersSent: number;
}

export interface DepartmentAnalyticsResponse {
  cycleYear: number;
  scopedToUnits: string[] | null;
  contribution: {
    departments: DepartmentContribution[];
    institute: {
      departmentsReporting: number;
      totalResearchFundingInr: number;
      creditedResearchFundingInr?: number;
      jointProjects?: number;
      jointProjectFundingInr?: number;
      totalResearchProjects: number;
      totalGraduated: number;
      totalPlaced: number;
      totalHigherStudies: number;
      totalPhdGraduated: number;
      totalStudentStrength: number;
      institutePlacementRatePct: number | null;
    };
    leaders?: Record<string, { unitId: string; unitName: string; shortName: string | null; value: number } | null>;
  };
  performance: {
    institute: {
      eligibleUnits: number;
      unitOwnedSections: number;
      expectedUnitSubmissions: number;
      totalSubmissions: number;
      approved: number;
      awaitingReview: number;
      inCorrection: number;
      draft: number;
      notApplicable: number;
      overallCompletionPct: number;
      avgReviewTurnaroundHours: number | null;
      unitsFullyComplete: number;
      unitsNotStarted: number;
    };
    departments: DepartmentPerformance[];
    sections: Array<{
      sectionId: string;
      title: string;
      submitBy: string;
      expected: number;
      received: number;
      settled: number;
      awaitingReview: number;
      inCorrection: number;
      completionPct: number;
    }>;
    leaderboard?: Record<string, DepartmentPerformance[]>;
  };
  /** Anonymous institute medians, present only in a department-scoped view. */
  benchmark?: DepartmentBenchmark | null;
}

export interface DepartmentBenchmark {
  withheld: boolean;
  reason?: string;
  unitsCompared?: number;
  medianResearchFundingInr?: number | null;
  medianPlacementRatePct?: number | null;
  medianOutcomeRatePct?: number | null;
  medianPhdGraduated?: number | null;
  medianCompletionPct?: number | null;
  medianFirstPassApprovalPct?: number | null;
}

// ---------------------------------------------------------------------------
// Audit trail (spec 2.11)
// ---------------------------------------------------------------------------

export interface AuditChange {
  block?: string;
  row?: string | null;
  field: string;
  old: unknown;
  new: unknown;
  pii?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actorType: string;
  actorId: string;
  actorName: string | null;
  submissionId: string | null;
  sectionId: string | null;
  unitId: string | null;
  unitName: string | null;
  requestId: string | null;
  requestReference: string | null;
  cycleYear: number | null;
  changeCount: number;
  delta: Record<string, any> & {
    comment?: string;
    fromStatus?: string;
    toStatus?: string;
    changes?: AuditChange[];
    records?: Array<{ rowKey: string; created: boolean; changes: AuditChange[] }>;
    kind?: string;
    sha256?: string;
  };
}

export interface AuditLogResponse {
  count: number;
  page: number;
  pageSize: number;
  results: AuditLogEntry[];
  actions: string[];
}

// ---------------------------------------------------------------------------
// Proof repository & provenance (spec 2.4)
// ---------------------------------------------------------------------------

export interface ProofEntry {
  id: string;
  requestId: string;
  requestReference: string | null;
  cycleYear: number | null;
  unitId: string;
  unitName: string | null;
  dataItemId: string;
  fileName: string;
  size: number;
  contentType: string;
  checksum: string;
  note: string;
  uploadedAt: string;
  uploadedBy: string | null;
  version: number;
  versionCount: number;
  isLatest: boolean;
  downloadUrl: string;
  sections?: Array<{ sectionId: string; title: string }>;
}

export interface ProofRepositoryResponse {
  count: number;
  page: number;
  pageSize: number;
  results: ProofEntry[];
}

