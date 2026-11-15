import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import NodalOfficerAnalytics from './NodalOfficerAnalytics';

// A plain function rather than vi.fn(): a spy derives its own promise from a
// rejected return value to record the result, and that derived promise goes
// unhandled and fails the test even though the component catches the original.
let impl: () => Promise<unknown> = () => new Promise(() => {});
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return { ...actual, analyticsService: { getDepartmentAnalytics: () => impl() } };
});

const dept = {
  unitId: 'scee', unitName: 'School of Computing and Electrical Engineering', shortName: 'SCEE', kind: 'SCHOOL',
  researchFundingInr: 8_000_000, sanctionedResearchInr: 0, researchProjects: 2, fundingAgencies: 1,
  graduated: 100, placed: 60, higherStudies: 20, phdGraduated: 0, studentStrength: 400, sanctionedIntake: 0,
  placementRatePct: 60, higherStudiesRatePct: 20, outcomeRatePct: 80, femaleSharePct: 25,
  fundingPerStudentInr: 20000, fundingSharePct: 100, sections: [],
};
const perf = {
  unitId: 'scee', unitName: 'SCEE', shortName: 'SCEE', kind: 'SCHOOL', isAcademicUnit: true,
  expectedSections: 5, sectionsTouched: 3, submissions: 3, approved: 3, submittedAwaitingReview: 0,
  draft: 0, correctionRequested: 0, notApplicable: 0, completionPct: 60,
  missingSections: ['phd-details'], recordsContributed: 2, correctionCycles: 0,
  firstPassApprovalPct: 100, avgReviewTurnaroundHours: null, remindersSent: 0,
};

function respond(benchmark: object) {
  const body = {
    cycleYear: 2027, scopedToUnits: ['scee'],
    contribution: { departments: [dept], institute: {} },
    performance: { departments: [perf], institute: {}, sections: [] },
    benchmark,
  };
  impl = () => Promise.resolve(body);
}

describe('NodalOfficerAnalytics', () => {
  beforeEach(() => { impl = () => new Promise(() => {}); });

  it('compares the department against anonymous institute medians', async () => {
    respond({ withheld: false, unitsCompared: 5, medianResearchFundingInr: 2_000_000,
              medianPlacementRatePct: 75, medianOutcomeRatePct: 70, medianPhdGraduated: 3,
              medianCompletionPct: 80, medianFirstPassApprovalPct: 90 });
    renderWithProviders(<NodalOfficerAnalytics />);

    expect(await screen.findByRole('heading', { name: 'SCEE' })).toBeInTheDocument();
    expect(screen.getByText('₹80.00 L')).toBeInTheDocument();
    expect(screen.getByText(/At or above institute median \(₹20.00 L\)/)).toBeInTheDocument();
    expect(screen.getByText(/Below institute median \(75%\)/)).toBeInTheDocument();
    expect(screen.getByText('phd-details')).toBeInTheDocument();
  });

  it('explains when benchmarks are withheld', async () => {
    respond({ withheld: true, reason: 'Fewer than 3 other units have approved returns.' });
    renderWithProviders(<NodalOfficerAnalytics />);
    expect(await screen.findByText(/Fewer than 3 other units/)).toBeInTheDocument();
    expect(screen.queryByText(/institute median/)).not.toBeInTheDocument();
  });

  it('shows the server reason when no department is assigned', async () => {
    // Axios rejects with an Error carrying the response.
    const forbidden = Object.assign(new Error('Request failed with status code 403'), {
      response: { status: 403, data: { error: 'No department is assigned to this account.' } },
    });
    impl = () => Promise.reject(forbidden);
    renderWithProviders(<NodalOfficerAnalytics />);
    expect(await screen.findByText('No department is assigned to this account.')).toBeInTheDocument();
  });
});
