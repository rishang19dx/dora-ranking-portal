/**
 * Catalogue of the ranking data items an administrator can request.
 *
 * Every item id doubles as an organogram "data scope" (see `dataScopes` on
 * `OrgUnit`), which is what lets the composer suggest the right data for the
 * sections an administrator selects - and the right sections for a data item.
 */

import { ORG_UNITS, getUnit } from './organogram';

export type RankingFramework = 'NIRF' | 'QS' | 'THE' | 'NAAC';

/** NIRF parameter groups, reused as a grouping key for every framework. */
export type ParameterGroup = 'TLR' | 'RPC' | 'GO' | 'OI' | 'PR' | 'INSTITUTIONAL';

export interface DataItem {
  id: string;
  label: string;
  group: ParameterGroup;
  frameworks: RankingFramework[];
  description: string;
  /** Acceptable proof formats communicated to the nodal officer. */
  proofFormats: string[];
}

export const PARAMETER_GROUP_LABELS: Record<ParameterGroup, string> = {
  TLR: 'Teaching, Learning & Resources',
  RPC: 'Research & Professional Practice',
  GO: 'Graduation Outcomes',
  OI: 'Outreach & Inclusivity',
  PR: 'Perception',
  INSTITUTIONAL: 'Institutional & Governance',
};

export const PARAMETER_GROUP_ORDER: ParameterGroup[] = [
  'TLR',
  'RPC',
  'GO',
  'OI',
  'PR',
  'INSTITUTIONAL',
];

const SHEET = ['XLSX', 'CSV'];
const DOC = ['PDF', 'DOCX'];

export const DATA_CATALOGUE: DataItem[] = [
  {
    id: 'student-intake',
    label: 'Student Strength & Intake (UG / PG / PhD)',
    group: 'TLR',
    frameworks: ['NIRF', 'QS', 'NAAC'],
    description: 'Sanctioned intake, actual admissions and total enrolment for each programme.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'admissions',
    label: 'Admissions & Entrance Examination Data',
    group: 'TLR',
    frameworks: ['NIRF', 'NAAC'],
    description: 'JEE / GATE seat matrix, opening-closing ranks and category-wise allotment.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'faculty-roster',
    label: 'Faculty Roster & Qualifications',
    group: 'TLR',
    frameworks: ['NIRF', 'QS', 'THE', 'NAAC'],
    description: 'Faculty list with designation, PhD status, experience and date of joining.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'sanctioned-positions',
    label: 'Sanctioned vs Filled Positions',
    group: 'TLR',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Approved posts against positions filled, for faculty and staff cadres.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'non-teaching-staff',
    label: 'Non-teaching Staff Strength',
    group: 'TLR',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Technical and administrative staff on roll, by cadre.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'capital-expenditure',
    label: 'Capital Expenditure',
    group: 'TLR',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Three-year capital spend on land, buildings, laboratories and equipment.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'operational-expenditure',
    label: 'Operational Expenditure',
    group: 'TLR',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Three-year operational spend including salaries, maintenance and seminars.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'library-resources',
    label: 'Library Holdings & E-resources',
    group: 'TLR',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Volumes, journal and database subscriptions with annual expenditure.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'campus-infrastructure',
    label: 'Campus Infrastructure & Facilities',
    group: 'TLR',
    frameworks: ['NIRF', 'THE', 'NAAC'],
    description: 'Built-up area, classrooms, laboratories, hostels and medical facilities.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'digital-learning',
    label: 'Digital & Online Learning Resources',
    group: 'TLR',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Smart classrooms, LMS usage, MOOC content and network capacity.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'publications',
    label: 'Publications & Citations (WoS / Scopus)',
    group: 'RPC',
    frameworks: ['NIRF', 'QS', 'THE'],
    description: 'Indexed publications with citation counts for the assessment period.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'sponsored-projects',
    label: 'Sponsored Research Projects & Funding',
    group: 'RPC',
    frameworks: ['NIRF', 'THE', 'NAAC'],
    description: 'Externally funded projects with sanctioned amount and funding agency.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'sponsored-projects-school',
    label: 'School-wise Research Funding',
    group: 'RPC',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Project-wise research receipts attributable to the school or centre.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'consultancy',
    label: 'Consultancy Projects & Earnings',
    group: 'RPC',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Industry consultancy assignments with earnings received.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'patents',
    label: 'Patents Filed, Published & Granted',
    group: 'RPC',
    frameworks: ['NIRF', 'NAAC'],
    description: 'IPR filings with application numbers and current status.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'entrepreneurship',
    label: 'Startups & Incubation',
    group: 'RPC',
    frameworks: ['NIRF', 'THE'],
    description: 'Incubated ventures, funding raised and technology transfers.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'phd-awarded',
    label: 'PhDs Awarded',
    group: 'GO',
    frameworks: ['NIRF', 'QS', 'THE'],
    description: 'Doctoral degrees awarded with supervisor and thesis details.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'graduation-outcomes',
    label: 'Graduation & Examination Outcomes',
    group: 'GO',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Students graduating in stipulated time, with result statistics.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'placement-higher-studies',
    label: 'Placement, Median Salary & Higher Studies',
    group: 'GO',
    frameworks: ['NIRF', 'QS', 'NAAC'],
    description: 'Placement offers, median annual package and higher-study admissions.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'diversity',
    label: 'Regional, Gender & Social Diversity',
    group: 'OI',
    frameworks: ['NIRF', 'QS', 'THE'],
    description: 'Student and faculty distribution by state, gender and social category.',
    proofFormats: [...SHEET, 'PDF'],
  },
  {
    id: 'international-outlook',
    label: 'International Students & Collaborations',
    group: 'OI',
    frameworks: ['NIRF', 'QS', 'THE'],
    description: 'Foreign enrolment, exchange programmes and active international MoUs.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'student-facilities',
    label: 'Student Facilities, Sports & Cultural Activities',
    group: 'OI',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Hostel occupancy, sports facilities, clubs and student support services.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'outreach-programmes',
    label: 'Continuing Education & Outreach',
    group: 'OI',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Short-term courses, executive programmes and community outreach.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'alumni-contribution',
    label: 'Alumni Network & Contributions',
    group: 'PR',
    frameworks: ['NIRF', 'QS', 'NAAC'],
    description: 'Registered alumni, endowments and financial contributions received.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'perception',
    label: 'Peer Perception & Media Presence',
    group: 'PR',
    frameworks: ['NIRF', 'QS', 'THE'],
    description: 'Employer and academic peer references, media coverage, public engagement.',
    proofFormats: [...SHEET, ...DOC],
  },
  {
    id: 'institute-profile',
    label: 'Institute Profile & Statutory Details',
    group: 'INSTITUTIONAL',
    frameworks: ['NIRF', 'QS', 'THE', 'NAAC'],
    description: 'Establishment details, approvals, accreditation status and institute profile.',
    proofFormats: DOC,
  },
  {
    id: 'governance-records',
    label: 'Governance & Statutory Body Records',
    group: 'INSTITUTIONAL',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Minutes and resolutions of BoG, Finance Committee and Senate.',
    proofFormats: DOC,
  },
  {
    id: 'audited-statements',
    label: 'Audited Financial Statements',
    group: 'INSTITUTIONAL',
    frameworks: ['NIRF', 'NAAC'],
    description: 'Audited annual accounts and utilisation certificates.',
    proofFormats: DOC,
  },
];

export const DATA_ITEM_INDEX: Map<string, DataItem> = new Map(
  DATA_CATALOGUE.map((item) => [item.id, item]),
);

export function getDataItem(id: string): DataItem | undefined {
  return DATA_ITEM_INDEX.get(id);
}

export function dataItemLabel(id: string): string {
  return DATA_ITEM_INDEX.get(id)?.label ?? id;
}

export function isValidDataItemId(id: string): boolean {
  return DATA_ITEM_INDEX.has(id);
}

/** Units that are custodians of a given data item. */
export function custodianUnitIds(dataItemId: string): string[] {
  return ORG_UNITS.filter((unit) => unit.dataScopes.includes(dataItemId)).map((unit) => unit.id);
}

/**
 * Data items the selected sections are custodians of - the "identify required
 * data" step of the request composer starts from this suggestion.
 */
export function suggestedDataItemIds(unitIds: string[]): string[] {
  const suggested = new Set<string>();
  unitIds.forEach((unitId) => {
    getUnit(unitId)?.dataScopes.forEach((scope) => {
      if (DATA_ITEM_INDEX.has(scope)) suggested.add(scope);
    });
  });
  return DATA_CATALOGUE.filter((item) => suggested.has(item.id)).map((item) => item.id);
}

/** Data items a given unit cannot supply - surfaced as a warning in the composer. */
export function unsupportedDataItemIds(unitId: string, dataItemIds: string[]): string[] {
  const scopes = new Set(getUnit(unitId)?.dataScopes ?? []);
  return dataItemIds.filter((id) => !scopes.has(id));
}

/** Union of accepted proof formats for the requested data items. */
export function proofFormatsFor(dataItemIds: string[]): string[] {
  const formats = new Set<string>();
  dataItemIds.forEach((id) => getDataItem(id)?.proofFormats.forEach((f) => formats.add(f)));
  return Array.from(formats).sort();
}
