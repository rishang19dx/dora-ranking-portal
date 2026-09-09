/** Aggregates officer assignment and request activity per organogram section. */

import { ORG_UNITS } from '../organogram';
import type { DataRequest, NodalOfficer, UnitCoverage } from '../types';

export function buildCoverage(
  officers: NodalOfficer[],
  requests: DataRequest[],
): Record<string, UnitCoverage> {
  const coverage: Record<string, UnitCoverage> = {};

  ORG_UNITS.forEach((unit) => {
    coverage[unit.id] = { unitId: unit.id, officerIds: [], openRequests: 0, pendingRequests: 0 };
  });

  officers.forEach((officer) => {
    if (officer.status === 'REVOKED') return;
    officer.unitIds.forEach((unitId) => {
      coverage[unitId]?.officerIds.push(officer.id);
    });
  });

  requests.forEach((request) => {
    request.targets.forEach((target) => {
      const entry = coverage[target.unitId];
      if (!entry) return;
      if (request.status !== 'CLOSED') entry.openRequests += 1;
      if (target.status !== 'SUBMITTED' && request.status !== 'CLOSED') entry.pendingRequests += 1;
      if (!entry.lastRequestedAt || request.dispatchedAt > entry.lastRequestedAt) {
        entry.lastRequestedAt = request.dispatchedAt;
      }
    });
  });

  return coverage;
}
