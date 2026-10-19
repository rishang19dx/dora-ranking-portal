/**
 * Institute organogram - the single structural source of truth for the portal.
 *
 * The hierarchy mirrors `Institute_Organogram.md` (Director -> Deans/Registrar ->
 * academic chairs, administrative offices and functional sections). Every unit
 * carries the mailbox published in the organogram plus the ranking data scopes
 * the unit actually owns, so data collection can be targeted at the exact level
 * of the institute that holds the evidence.
 */

export type OrgUnitType =
  | 'GOVERNANCE'
  | 'EXECUTIVE'
  | 'ACADEMIC'
  | 'ADMINISTRATIVE'
  | 'FUNCTIONAL';

export interface OrgUnit {
  id: string;
  name: string;
  shortName?: string;
  type: OrgUnitType;
  /** Designation of the office holder responsible for the unit. */
  head?: string;
  /** Official mailbox as published in the institute organogram. */
  email?: string;
  description?: string;
  /** Ids from the data catalogue that this unit is the custodian of. */
  dataScopes: string[];
  children?: OrgUnit[];
}

export const ORG_UNIT_TYPES: OrgUnitType[] = [
  'GOVERNANCE',
  'EXECUTIVE',
  'ACADEMIC',
  'ADMINISTRATIVE',
  'FUNCTIONAL',
];

export const ORG_UNIT_TYPE_LABELS: Record<OrgUnitType, string> = {
  GOVERNANCE: 'Governance',
  EXECUTIVE: 'Executive',
  ACADEMIC: 'Academic',
  ADMINISTRATIVE: 'Administrative',
  FUNCTIONAL: 'Functional',
};

const school = (
  id: string,
  name: string,
  shortName: string,
  email: string | undefined,
  kind: 'School' | 'Centre',
): OrgUnit => ({
  id,
  name,
  shortName,
  type: 'ACADEMIC',
  head: kind === 'School' ? `Chairperson, ${shortName}` : `Coordinator, ${shortName}`,
  email,
  description: `${kind} faculty body - academic programmes, faculty roster and research output for ${shortName}.`,
  dataScopes: [
    'student-intake',
    'faculty-roster',
    'phd-awarded',
    'publications',
    'placement-higher-studies',
    'sponsored-projects-school',
  ],
  children: [
    {
      id: `${id}-faculty-body`,
      name: `${kind} Faculty Body`,
      type: 'ACADEMIC',
      head: `${kind} Faculty Body, ${shortName}`,
      description: `Faculty of ${shortName}. Custodian of individual faculty qualifications and publication records.`,
      dataScopes: ['faculty-roster', 'publications', 'phd-awarded'],
    },
  ],
});

export const ORGANOGRAM: OrgUnit = {
  id: 'iit-mandi',
  name: 'Indian Institute of Technology Mandi',
  shortName: 'IIT Mandi',
  type: 'GOVERNANCE',
  head: 'Institute',
  description: 'Root of the institute organogram. All ranking data rolls up to this node.',
  dataScopes: [],
  children: [
    {
      id: 'standing-committee',
      name: 'Institute Standing Committee (Recommendations to Board of Governors)',
      shortName: 'ISC',
      type: 'GOVERNANCE',
      head: 'Chairperson, Standing Committee',
      description: 'Recommends institute-level policy to the Board of Governors.',
      dataScopes: ['governance-records'],
    },
    {
      id: 'director',
      name: "Director's Office",
      shortName: 'Director',
      type: 'EXECUTIVE',
      head: 'Director',
      email: 'director@iitmandi.ac.in',
      description: 'Head of the institute. Approving authority for all ranking submissions.',
      dataScopes: ['governance-records', 'institute-profile'],
      children: [
        {
          id: 'execom',
          name: 'Institute ExeCom (All Deans and Registrar)',
          shortName: 'ExeCom',
          type: 'EXECUTIVE',
          head: 'Institute Executive Committee',
          description: 'Executive committee of all Deans and the Registrar.',
          dataScopes: ['governance-records'],
        },
        {
          id: 'audit',
          name: 'Audit',
          type: 'FUNCTIONAL',
          head: 'Internal Audit Officer',
          description: 'Internal and statutory audit of institute accounts.',
          dataScopes: ['audited-statements'],
        },
        {
          id: 'recruitment-cell',
          name: 'Recruitment Cell (under Deputy Registrar I)',
          shortName: 'Recruitment',
          type: 'ADMINISTRATIVE',
          head: 'Deputy Registrar I',
          description: 'Faculty and staff recruitment, sanctioned vs filled positions.',
          dataScopes: ['sanctioned-positions', 'faculty-roster'],
        },
        {
          id: 'dean-infra',
          name: 'Dean, Infrastructure & Services',
          shortName: 'Infrastructure',
          type: 'ADMINISTRATIVE',
          head: 'Dean, Infrastructure & Services',
          email: 'deaninfra@iitmandi.ac.in',
          description: 'Campus infrastructure, services and utilities.',
          dataScopes: ['campus-infrastructure', 'capital-expenditure'],
          children: [
            {
              id: 'estate-works',
              name: 'Estate & Works',
              type: 'FUNCTIONAL',
              head: 'Superintending Engineer',
              description: 'Built-up area, laboratories, classrooms and ongoing works.',
              dataScopes: ['campus-infrastructure', 'capital-expenditure'],
            },
            {
              id: 'medical-services',
              name: 'Medical Services',
              type: 'FUNCTIONAL',
              head: 'Senior Medical Officer',
              description: 'Health centre facilities and medical support for students and staff.',
              dataScopes: ['campus-infrastructure', 'student-facilities'],
            },
            {
              id: 'it-services',
              name: 'IT Services & Communications',
              shortName: 'IT Services',
              type: 'FUNCTIONAL',
              head: 'Head, Computer Centre',
              description: 'Network, computing facilities, digital learning infrastructure.',
              dataScopes: ['campus-infrastructure', 'digital-learning'],
            },
            {
              id: 'transport',
              name: 'Transport',
              type: 'FUNCTIONAL',
              head: 'Transport Officer',
              description: 'Institute transport fleet and campus mobility.',
              dataScopes: ['campus-infrastructure'],
            },
          ],
        },
        {
          id: 'dean-academics',
          name: 'Dean, Academics',
          shortName: 'Academics',
          type: 'ACADEMIC',
          head: 'Dean, Academics',
          email: 'deanacad@iitmandi.ac.in',
          description: 'Admissions, academic programmes, examinations and the library.',
          dataScopes: ['student-intake', 'admissions', 'graduation-outcomes', 'digital-learning'],
          children: [
            {
              id: 'jee-gate-admissions',
              name: 'JEE, GATE & Admissions',
              shortName: 'Admissions',
              type: 'FUNCTIONAL',
              head: 'Chairperson, Admissions',
              description: 'Entrance examinations, seat matrix, regional and social diversity of intake.',
              dataScopes: ['admissions', 'student-intake', 'diversity'],
            },
            {
              id: 'academic-courses-research',
              name: 'Academic Courses and Research',
              shortName: 'Academic Section',
              type: 'FUNCTIONAL',
              head: 'Assistant Registrar (Academics)',
              description: 'Programme structure, examination results, graduation outcomes.',
              dataScopes: ['graduation-outcomes', 'student-intake', 'phd-awarded'],
            },
            {
              id: 'library',
              name: 'Library',
              type: 'FUNCTIONAL',
              head: 'Librarian',
              description: 'Library holdings, e-resource subscriptions and annual library expenditure.',
              dataScopes: ['library-resources', 'operational-expenditure'],
            },
            school('shss', 'School of Humanities and Social Sciences', 'SHSS', 'shssoffice@iitmandi.ac.in', 'School'),
            school('sbs', 'School of Biosciences and Bioengineering', 'SBS', 'chairsbs@iitmandi.ac.in', 'School'),
            school('scee', 'School of Civil and Environmental Engineering', 'SCEE', 'chairscee@iitmandi.ac.in', 'School'),
            school('se', 'School of Engineering', 'SE', undefined, 'School'),
            school('smss', 'School of Mathematical and Statistical Sciences', 'SMSS', 'chairsmss@iitmandi.ac.in', 'School'),
            school('som', 'School of Management', 'SoM', 'chairsom@iitmandi.ac.in', 'School'),
            school('scene', 'School of Chemical Sciences and Energy Engineering', 'SCENE', 'chair_scene@iitmandi.ac.in', 'School'),
            school('cqst', 'Centre for Quantum Science and Technologies', 'CQST', 'chaircqst@iitmandi.ac.in', 'Centre'),
            school('amrc', 'Advanced Materials Research Centre', 'AMRC', 'amrc@iitmandi.ac.in', 'Centre'),
          ],
        },
        {
          id: 'dean-students',
          name: 'Dean, Student Affairs',
          shortName: 'Student Affairs',
          type: 'ADMINISTRATIVE',
          head: 'Dean, Student Affairs',
          email: 'deanstudents@iitmandi.ac.in',
          description: 'Student life, hostels, sports, alumni and international students.',
          dataScopes: ['student-facilities', 'alumni-contribution', 'diversity'],
          children: [
            {
              id: 'cultural-activities',
              name: 'Cultural Activities',
              type: 'FUNCTIONAL',
              head: 'Faculty In-charge, Cultural Affairs',
              description: 'Cultural festivals, clubs and student societies.',
              dataScopes: ['student-facilities'],
            },
            {
              id: 'sports',
              name: 'Sports',
              type: 'FUNCTIONAL',
              head: 'Faculty In-charge, Sports',
              description: 'Sports infrastructure, participation and achievements.',
              dataScopes: ['student-facilities'],
            },
            {
              id: 'hostels',
              name: 'Hostels',
              type: 'FUNCTIONAL',
              head: 'Chief Warden',
              description: 'Hostel capacity, occupancy and residential facilities.',
              dataScopes: ['student-facilities', 'campus-infrastructure'],
            },
            {
              id: 'foreign-students',
              name: 'Foreign Students Office',
              shortName: 'International',
              type: 'FUNCTIONAL',
              head: 'Advisor, International Relations',
              description: 'International student enrolment, exchange programmes and MoUs.',
              dataScopes: ['diversity', 'international-outlook'],
            },
            {
              id: 'alumni-affairs',
              name: 'Alumni Affairs',
              type: 'FUNCTIONAL',
              head: 'Head, Alumni Relations',
              description: 'Alumni network, endowments and financial contributions.',
              dataScopes: ['alumni-contribution'],
            },
          ],
        },
        {
          id: 'dean-sric',
          name: 'Dean, Sponsored Research & Industrial Consultancy',
          shortName: 'SRIC',
          type: 'ACADEMIC',
          head: 'Dean, SRIC',
          email: 'deansric@iitmandi.ac.in',
          description: 'Sponsored research, consultancy, IPR and entrepreneurship.',
          dataScopes: ['sponsored-projects', 'consultancy', 'patents', 'entrepreneurship'],
          children: [
            {
              id: 'sponsored-research',
              name: 'Sponsored Research',
              type: 'FUNCTIONAL',
              head: 'Associate Dean, Sponsored Research',
              description: 'Externally funded research projects and grant receipts.',
              dataScopes: ['sponsored-projects'],
            },
            {
              id: 'consultancy',
              name: 'Consultancy',
              type: 'FUNCTIONAL',
              head: 'Associate Dean, Consultancy',
              description: 'Industry consultancy projects and earnings.',
              dataScopes: ['consultancy'],
            },
            {
              id: 'ipr-entrepreneurship',
              name: 'IPR & Entrepreneurship Policy',
              shortName: 'IPR & Startups',
              type: 'FUNCTIONAL',
              head: 'Head, IPR Cell',
              description: 'Patents filed, published and granted; incubated startups.',
              dataScopes: ['patents', 'entrepreneurship'],
            },
            {
              id: 'continuing-education',
              name: 'Continuing Education',
              type: 'FUNCTIONAL',
              head: 'Head, Continuing Education',
              description: 'Outreach programmes, executive education and short courses.',
              dataScopes: ['outreach-programmes'],
            },
          ],
        },
        {
          id: 'dean-finance',
          name: 'Dean, Finance & Purchase',
          shortName: 'Finance',
          type: 'ADMINISTRATIVE',
          head: 'Dean, Finance & Purchase',
          email: 'deanfinance@iitmandi.ac.in',
          description: 'Institute budget, purchases and accounts.',
          dataScopes: ['capital-expenditure', 'operational-expenditure', 'audited-statements'],
          children: [
            {
              id: 'budget',
              name: 'Budget',
              type: 'FUNCTIONAL',
              head: 'Deputy Registrar (Finance)',
              description: 'Annual budget allocation and utilisation.',
              dataScopes: ['capital-expenditure', 'operational-expenditure'],
            },
            {
              id: 'stores-purchase',
              name: 'Stores & Purchase',
              type: 'FUNCTIONAL',
              head: 'Assistant Registrar (Stores & Purchase)',
              description: 'Equipment procurement and capital asset register.',
              dataScopes: ['capital-expenditure'],
            },
            {
              id: 'accounts',
              name: 'Accounts',
              type: 'FUNCTIONAL',
              head: 'Assistant Registrar (Accounts)',
              description: 'Audited financial statements and expenditure heads.',
              dataScopes: ['audited-statements', 'operational-expenditure'],
            },
          ],
        },
        {
          id: 'dean-faculty',
          name: 'Dean, Faculty',
          shortName: 'Faculty Affairs',
          type: 'ADMINISTRATIVE',
          head: 'Dean, Faculty',
          email: 'deanfaculty@iitmandi.ac.in',
          description: 'All service matters and facilities for faculty.',
          dataScopes: ['faculty-roster', 'sanctioned-positions'],
          children: [
            {
              id: 'faculty-service-matters',
              name: 'Faculty Service Matters & Facilities',
              shortName: 'Faculty Services',
              type: 'FUNCTIONAL',
              head: 'Assistant Registrar (Faculty Affairs)',
              description: 'Faculty appointments, qualifications, experience and retention records.',
              dataScopes: ['faculty-roster', 'sanctioned-positions'],
            },
          ],
        },
        {
          id: 'registrar',
          name: 'Registrar',
          type: 'ADMINISTRATIVE',
          head: 'Registrar',
          email: 'registrar@iitmandi.ac.in',
          description: 'Chief administrative officer of the institute.',
          dataScopes: ['governance-records', 'institute-profile'],
          children: [
            {
              id: 'deputy-registrar-1',
              name: 'Deputy Registrar I',
              shortName: 'DR-I',
              type: 'ADMINISTRATIVE',
              head: 'Deputy Registrar I',
              description: 'Establishment matters for non-teaching employees.',
              dataScopes: ['non-teaching-staff'],
              children: [
                {
                  id: 'non-teaching-service',
                  name: 'Service Matters, Non-teaching Employees',
                  shortName: 'Establishment',
                  type: 'FUNCTIONAL',
                  head: 'Assistant Registrar (Establishment)',
                  description: 'Non-teaching staff strength, sanctioned and filled posts.',
                  dataScopes: ['non-teaching-staff', 'sanctioned-positions'],
                  children: [
                    {
                      id: 'rti-legal',
                      name: 'RTI, Parliament Questions & Legal Services',
                      shortName: 'RTI & Legal',
                      type: 'FUNCTIONAL',
                      head: 'Public Information Officer',
                      description: 'External queries, RTI responses and legal compliance records.',
                      dataScopes: ['governance-records'],
                    },
                  ],
                },
              ],
            },
            {
              id: 'deputy-registrar-2',
              name: 'Deputy Registrar II',
              shortName: 'DR-II',
              type: 'ADMINISTRATIVE',
              head: 'Deputy Registrar II',
              description: 'Statutory bodies and institute public relations.',
              dataScopes: ['governance-records'],
              children: [
                {
                  id: 'statutory-meetings',
                  name: 'Meetings of BoG, Finance Committee & Senate',
                  shortName: 'Statutory Bodies',
                  type: 'FUNCTIONAL',
                  head: 'Assistant Registrar (Council Affairs)',
                  description: 'Minutes and resolutions of statutory bodies.',
                  dataScopes: ['governance-records'],
                  children: [
                    {
                      id: 'public-relations',
                      name: 'Public Relations & Guest Facilities',
                      shortName: 'Public Relations',
                      type: 'FUNCTIONAL',
                      head: 'Public Relations Officer',
                      description: 'Institute perception, media presence and visitor facilities.',
                      dataScopes: ['perception', 'institute-profile'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export interface OrgIndexEntry {
  unit: OrgUnit;
  parentId: string | null;
  depth: number;
  /** Ids from the root down to (and including) this unit. */
  path: string[];
}

function buildIndex(): Map<string, OrgIndexEntry> {
  const index = new Map<string, OrgIndexEntry>();

  const walk = (unit: OrgUnit, parentId: string | null, depth: number, path: string[]) => {
    const nextPath = [...path, unit.id];
    index.set(unit.id, { unit, parentId, depth, path: nextPath });
    unit.children?.forEach((child) => walk(child, unit.id, depth + 1, nextPath));
  };

  walk(ORGANOGRAM, null, 0, []);
  return index;
}

export const ORG_INDEX: Map<string, OrgIndexEntry> = buildIndex();

export const ORG_UNITS: OrgUnit[] = Array.from(ORG_INDEX.values(), (entry) => entry.unit);

export function getUnit(id: string): OrgUnit | undefined {
  return ORG_INDEX.get(id)?.unit;
}

export function getEntry(id: string): OrgIndexEntry | undefined {
  return ORG_INDEX.get(id);
}

export function unitLabel(id: string): string {
  const unit = getUnit(id);
  if (!unit) return id;
  return unit.shortName ?? unit.name;
}

/** Breadcrumb of unit names from the Director's office down to the unit. */
export function unitBreadcrumb(id: string): string[] {
  const entry = ORG_INDEX.get(id);
  if (!entry) return [];
  return entry.path.slice(1, -1).map((ancestorId) => unitLabel(ancestorId));
}

export function getDescendantIds(id: string, includeSelf = false): string[] {
  const unit = getUnit(id);
  if (!unit) return [];
  const ids: string[] = includeSelf ? [unit.id] : [];
  const walk = (node: OrgUnit) => {
    node.children?.forEach((child) => {
      ids.push(child.id);
      walk(child);
    });
  };
  walk(unit);
  return ids;
}

export function getAncestorIds(id: string): string[] {
  const entry = ORG_INDEX.get(id);
  if (!entry) return [];
  return entry.path.slice(0, -1);
}

export function isValidUnitId(id: string): boolean {
  return ORG_INDEX.has(id);
}

/** Case-insensitive search across unit name, short name, head and mailbox. */
export function searchUnitIds(query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return ORG_UNITS.filter((unit) =>
    [unit.name, unit.shortName, unit.head, unit.email, unit.description]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(needle)),
  ).map((unit) => unit.id);
}

/** Every data scope owned by the given units (deduplicated, order preserved). */
export function scopesForUnits(unitIds: string[]): string[] {
  const scopes = new Set<string>();
  unitIds.forEach((id) => getUnit(id)?.dataScopes.forEach((scope) => scopes.add(scope)));
  return Array.from(scopes);
}

/** Schools and centres headed by a Chairperson/Coordinator under Dean, Academics. */
export const SCHOOL_UNIT_IDS = [
  'shss',
  'sbs',
  'scee',
  'se',
  'smss',
  'som',
  'scene',
  'cqst',
  'amrc',
];

/** Offices reporting directly to the Director. */
export const DEAN_UNIT_IDS = [
  'dean-infra',
  'dean-academics',
  'dean-students',
  'dean-sric',
  'dean-finance',
  'dean-faculty',
  'registrar',
];

/** Every section that owns at least one ranking data item. */
export function dataOwningUnitIds(): string[] {
  return ORG_UNITS.filter((unit) => unit.dataScopes.length > 0).map((unit) => unit.id);
}
