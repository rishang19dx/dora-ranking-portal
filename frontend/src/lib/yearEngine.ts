/**
 * Year engine implementing the NIRF cycle year model in TypeScript.
 * Matches Python implementation in backend/apps/submissions/year_engine.py.
 */

export function latestAcademicYearStart(cycleYear: number): number {
  return cycleYear - 2;
}

export function latestFinancialYearStart(cycleYear: number): number {
  return cycleYear - 2;
}

export function latestCalendarYear(cycleYear: number): number {
  return cycleYear - 2;
}

export function nextAcademicYearStart(cycleYear: number): number {
  return cycleYear - 1;
}

export function academicYearLabel(startYear: number): string {
  const endSuffix = (startYear + 1) % 100;
  return `${startYear}-${endSuffix.toString().padStart(2, '0')}`;
}

export function financialYearLabel(startYear: number): string {
  return academicYearLabel(startYear);
}

export function resolveYearSeries(kind: 'academic' | 'financial' | 'calendar', count: number, cycleYear: number): (string | number)[] {
  if (count <= 0) return [];

  if (kind === 'academic' || kind === 'financial') {
    const baseStart = latestAcademicYearStart(cycleYear);
    return Array.from({ length: count }, (_, i) => academicYearLabel(baseStart - i));
  } else if (kind === 'calendar') {
    const baseYear = latestCalendarYear(cycleYear);
    return Array.from({ length: count }, (_, i) => baseYear - i);
  }
  throw new Error(`Unknown series kind: ${kind}`);
}

export function getYearContext(cycleYear: number): Record<string, string> {
  const layStart = latestAcademicYearStart(cycleYear);
  const nayStart = nextAcademicYearStart(cycleYear);
  return {
    cycleYear: cycleYear.toString(),
    latestAcademicYear: academicYearLabel(layStart),
    latestFinancialYear: financialYearLabel(layStart),
    latestCalendarYear: latestCalendarYear(cycleYear).toString(),
    nextAcademicYear: academicYearLabel(nayStart),
  };
}

export function resolveBatchYears(graduatingAyLabel: string, level: string): {
  graduationAcademicYear: string;
  entryAcademicYear: string | null;
  lateralAcademicYear: string | null;
} {
  const gradStart = parseInt(graduatingAyLabel.split('-')[0], 10);
  if (isNaN(gradStart)) {
    throw new Error(`Invalid academic year label: ${graduatingAyLabel}`);
  }

  if (level === 'UG4') {
    return {
      graduationAcademicYear: graduatingAyLabel,
      entryAcademicYear: academicYearLabel(gradStart - 3),
      lateralAcademicYear: academicYearLabel(gradStart - 2),
    };
  } else if (level === 'PG2') {
    return {
      graduationAcademicYear: graduatingAyLabel,
      entryAcademicYear: academicYearLabel(gradStart - 1),
      lateralAcademicYear: null,
    };
  }

  return {
    graduationAcademicYear: graduatingAyLabel,
    entryAcademicYear: null,
    lateralAcademicYear: null,
  };
}

