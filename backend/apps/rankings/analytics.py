"""
Executive analytics for the NIRF ranking datasets.

Two things leadership asks for that the raw rank tables cannot answer:

1. How has each NIRF parameter (TLR, RPC, GO, OI, PR) moved for IIT Mandi
   over the published cycles, rather than just the headline rank.
2. Where is the institute losing the most score against its 2nd-generation
   IIT peers, expressed in the weighted points the overall score is built
   from, so effort can be pointed at the parameter that actually pays.

The weight model below is NIRF's published composition of the total score.
It reconciles to the published totals for every institute-year in the
cached datasets (max deviation 0.02, i.e. rounding only).
"""

from typing import Any, Dict, List, Optional

PARAMETER_WEIGHTS = {
    'tlr': 0.30,
    'rpc': 0.30,
    'go': 0.20,
    'oi': 0.10,
    'pr': 0.10,
}

PARAMETER_LABELS = {
    'tlr': 'Teaching, Learning & Resources',
    'rpc': 'Research & Professional Practice',
    'go': 'Graduation Outcomes',
    'oi': 'Outreach & Inclusivity',
    'pr': 'Perception',
}

PARAMETER_ORDER = ['tlr', 'rpc', 'go', 'oi', 'pr']

TARGET_INSTITUTE = "Indian Institute of Technology Mandi"

# Categories for which NIRF publishes parameter sub-scores. Innovation is
# released as ranks/bands only, so parameter analytics do not apply to it.
PARAMETRIC_CATEGORIES = ['Engineering', 'Overall']


def _as_number(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def weighted_total(parameters: Dict[str, Any]) -> Optional[float]:
    """Recompose the NIRF total score from parameter sub-scores."""
    if not parameters:
        return None
    total = 0.0
    for key, weight in PARAMETER_WEIGHTS.items():
        val = _as_number(parameters.get(key))
        if val is None:
            return None
        total += weight * val
    return round(total, 2)


def compute_parameter_trends(load_ranking_data, category: str, years: List[int]) -> Dict[str, Any]:
    """
    IIT Mandi's parameter-level history for one category.

    Returns one entry per year with every parameter sub-score, its weighted
    contribution to the total, and the year-on-year movement.
    """
    series: List[Dict[str, Any]] = []

    for year in years:
        rows = load_ranking_data(year, category.lower()) or []
        row = next((r for r in rows if TARGET_INSTITUTE.lower() in str(r.get('name', '')).lower()), None)
        if not row:
            continue

        params = row.get('parameters') or {}
        entry: Dict[str, Any] = {
            'year': year,
            'rank': row.get('rank'),
            'score': row.get('score'),
            'parameters': {},
            'hasParameters': bool(params),
        }
        for key in PARAMETER_ORDER:
            val = _as_number(params.get(key))
            entry['parameters'][key] = {
                'key': key,
                'label': PARAMETER_LABELS[key],
                'value': val,
                'weight': PARAMETER_WEIGHTS[key],
                'weightedContribution': round(PARAMETER_WEIGHTS[key] * val, 2) if val is not None else None,
            }
        entry['recomposedScore'] = weighted_total(params)
        series.append(entry)

    series.sort(key=lambda e: e['year'])

    # Year-on-year deltas per parameter.
    for idx, entry in enumerate(series):
        if idx == 0:
            entry['parameterDeltas'] = {k: None for k in PARAMETER_ORDER}
            continue
        prev = series[idx - 1]['parameters']
        deltas = {}
        for key in PARAMETER_ORDER:
            cur_val = entry['parameters'][key]['value']
            prev_val = prev[key]['value']
            deltas[key] = round(cur_val - prev_val, 2) if (cur_val is not None and prev_val is not None) else None
        entry['parameterDeltas'] = deltas

    movement = None
    if len(series) >= 2:
        first, last = series[0], series[-1]
        movement = {
            'fromYear': first['year'],
            'toYear': last['year'],
            'parameters': {
                key: (
                    round(last['parameters'][key]['value'] - first['parameters'][key]['value'], 2)
                    if last['parameters'][key]['value'] is not None and first['parameters'][key]['value'] is not None
                    else None
                )
                for key in PARAMETER_ORDER
            },
        }

    return {
        'category': category,
        'targetInstitute': TARGET_INSTITUTE,
        'weights': PARAMETER_WEIGHTS,
        'labels': PARAMETER_LABELS,
        'series': series,
        'netMovement': movement,
    }


def compute_gap_analysis(
    load_ranking_data,
    canonical_name,
    peer_names: List[str],
    category: str,
    year: int,
) -> Dict[str, Any]:
    """
    Parameter-level gap analysis for IIT Mandi against its peer IITs.

    For each NIRF parameter the result carries the peer best and peer median,
    the institute's shortfall against both, and - the part leadership acts on -
    the weighted points that closing the gap would add to the total score.
    """
    rows = load_ranking_data(year, category.lower()) or []

    peer_set = {name for name in peer_names}
    observed: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        c_name = canonical_name(str(row.get('name', '')))
        if c_name in peer_set:
            observed[c_name] = row

    target = observed.get(TARGET_INSTITUTE)
    if target is None:
        return {
            'category': category,
            'year': year,
            'available': False,
            'reason': f"IIT Mandi is not present in the {year} {category} dataset.",
            'parameters': [],
            'peers': [],
        }

    target_params = target.get('parameters') or {}
    if not target_params:
        return {
            'category': category,
            'year': year,
            'available': False,
            'reason': (
                f"NIRF does not publish parameter sub-scores for the {category} "
                f"category, so a parameter gap analysis is not possible."
            ),
            'parameters': [],
            'peers': [
                {
                    'institute': name,
                    'rank': row.get('rank'),
                    'score': row.get('score'),
                    'isTarget': name == TARGET_INSTITUTE,
                }
                for name, row in sorted(
                    observed.items(),
                    key=lambda kv: kv[1].get('rank') if isinstance(kv[1].get('rank'), (int, float)) else 10 ** 6,
                )
            ],
        }

    peers = [
        {
            'institute': name,
            'rank': row.get('rank'),
            'score': row.get('score'),
            'parameters': row.get('parameters') or {},
            'isTarget': name == TARGET_INSTITUTE,
        }
        for name, row in observed.items()
    ]
    peers.sort(key=lambda p: p['rank'] if isinstance(p['rank'], (int, float)) else 10 ** 6)

    parameter_rows: List[Dict[str, Any]] = []
    for key in PARAMETER_ORDER:
        own = _as_number(target_params.get(key))
        peer_values = [
            (p['institute'], _as_number(p['parameters'].get(key)))
            for p in peers
            if not p['isTarget']
        ]
        peer_values = [(n, v) for n, v in peer_values if v is not None]

        if own is None or not peer_values:
            parameter_rows.append({
                'key': key,
                'label': PARAMETER_LABELS[key],
                'weight': PARAMETER_WEIGHTS[key],
                'own': own,
                'peerBest': None,
                'peerBestInstitute': None,
                'peerMedian': None,
                'gapToBest': None,
                'gapToMedian': None,
                'weightedUpsideToBest': None,
                'percentileAmongPeers': None,
            })
            continue

        peer_values.sort(key=lambda nv: nv[1], reverse=True)
        best_institute, best_value = peer_values[0]
        sorted_vals = sorted(v for _, v in peer_values)
        mid = len(sorted_vals) // 2
        median = (
            sorted_vals[mid]
            if len(sorted_vals) % 2 == 1
            else (sorted_vals[mid - 1] + sorted_vals[mid]) / 2
        )

        gap_to_best = round(best_value - own, 2)
        beaten = sum(1 for _, v in peer_values if own > v)
        parameter_rows.append({
            'key': key,
            'label': PARAMETER_LABELS[key],
            'weight': PARAMETER_WEIGHTS[key],
            'own': round(own, 2),
            'peerBest': round(best_value, 2),
            'peerBestInstitute': best_institute,
            'peerMedian': round(median, 2),
            'gapToBest': gap_to_best,
            'gapToMedian': round(median - own, 2),
            # Weighted points the total score would gain by matching the best peer.
            'weightedUpsideToBest': round(max(gap_to_best, 0.0) * PARAMETER_WEIGHTS[key], 2),
            'percentileAmongPeers': round(100.0 * beaten / len(peer_values), 1),
            'leadsPeers': gap_to_best <= 0,
        })

    # Priority = where the weighted upside is largest.
    priorities = sorted(
        [r for r in parameter_rows if (r['weightedUpsideToBest'] or 0) > 0],
        key=lambda r: r['weightedUpsideToBest'],
        reverse=True,
    )

    total_upside = round(sum(r['weightedUpsideToBest'] or 0 for r in parameter_rows), 2)

    return {
        'category': category,
        'year': year,
        'available': True,
        'targetInstitute': TARGET_INSTITUTE,
        'targetRank': target.get('rank'),
        'targetScore': target.get('score'),
        'recomposedScore': weighted_total(target_params),
        'weights': PARAMETER_WEIGHTS,
        'parameters': parameter_rows,
        'priorities': [
            {
                'key': r['key'],
                'label': r['label'],
                'gapToBest': r['gapToBest'],
                'weightedUpsideToBest': r['weightedUpsideToBest'],
                'peerBestInstitute': r['peerBestInstitute'],
            }
            for r in priorities
        ],
        'totalWeightedUpside': total_upside,
        'peers': [
            {
                'institute': p['institute'],
                'rank': p['rank'],
                'score': p['score'],
                'isTarget': p['isTarget'],
                'parameters': {k: _as_number(p['parameters'].get(k)) for k in PARAMETER_ORDER},
            }
            for p in peers
        ],
    }


def compute_own_history_gap(
    load_ranking_data,
    category: str,
    year: int,
    years: List[int],
) -> Dict[str, Any]:
    """
    Gap against the institute's own past, per parameter.

    Spec 2.15 asks for gap analysis against peer benchmarks *or the institute's
    own historical averages*, which are different questions: a parameter can
    lead the peer set while still being down on where IIT Mandi itself used to
    be. Peer gaps come from `compute_gap_analysis`; this is the other half.

    The mean and best are taken over the prior years only, so the current year
    is compared against history rather than against itself.
    """
    prior_years = sorted(y for y in years if y < year)

    current_rows = load_ranking_data(year, category.lower()) or []
    current = next(
        (r for r in current_rows if TARGET_INSTITUTE.lower() in str(r.get('name', '')).lower()),
        None,
    )
    current_params = (current or {}).get('parameters') or {}

    if not current_params or not prior_years:
        return {
            'category': category,
            'year': year,
            'available': False,
            'reason': (
                f"No parameter history available for {category} before {year}."
            ),
            'parameters': [],
        }

    # Collect the institute's own prior values per parameter.
    history: Dict[str, List[Dict[str, Any]]] = {k: [] for k in PARAMETER_ORDER}
    for y in prior_years:
        rows = load_ranking_data(y, category.lower()) or []
        row = next(
            (r for r in rows if TARGET_INSTITUTE.lower() in str(r.get('name', '')).lower()),
            None,
        )
        params = (row or {}).get('parameters') or {}
        for key in PARAMETER_ORDER:
            val = _as_number(params.get(key))
            if val is not None:
                history[key].append({'year': y, 'value': val})

    parameter_rows: List[Dict[str, Any]] = []
    for key in PARAMETER_ORDER:
        own = _as_number(current_params.get(key))
        past = history[key]

        if own is None or not past:
            parameter_rows.append({
                'key': key,
                'label': PARAMETER_LABELS[key],
                'weight': PARAMETER_WEIGHTS[key],
                'own': own,
                'historicalMean': None,
                'historicalBest': None,
                'historicalBestYear': None,
                'deltaVsMean': None,
                'deltaVsBest': None,
                'weightedUpsideToOwnBest': None,
                'belowOwnAverage': None,
            })
            continue

        values = [p['value'] for p in past]
        mean = sum(values) / len(values)
        best_entry = max(past, key=lambda p: p['value'])
        delta_vs_best = round(best_entry['value'] - own, 2)

        parameter_rows.append({
            'key': key,
            'label': PARAMETER_LABELS[key],
            'weight': PARAMETER_WEIGHTS[key],
            'own': round(own, 2),
            'historicalMean': round(mean, 2),
            'historicalBest': round(best_entry['value'], 2),
            'historicalBestYear': best_entry['year'],
            'deltaVsMean': round(mean - own, 2),
            'deltaVsBest': delta_vs_best,
            # Weighted points regained by returning to the institute's own peak.
            'weightedUpsideToOwnBest': round(max(delta_vs_best, 0.0) * PARAMETER_WEIGHTS[key], 2),
            'belowOwnAverage': own < mean,
            'history': past,
        })

    regressions = sorted(
        [r for r in parameter_rows if (r['weightedUpsideToOwnBest'] or 0) > 0],
        key=lambda r: r['weightedUpsideToOwnBest'],
        reverse=True,
    )

    return {
        'category': category,
        'year': year,
        'available': True,
        'comparedAgainstYears': prior_years,
        'weights': PARAMETER_WEIGHTS,
        'parameters': parameter_rows,
        'belowOwnAverage': [r['key'] for r in parameter_rows if r.get('belowOwnAverage')],
        'regressions': [
            {
                'key': r['key'],
                'label': r['label'],
                'deltaVsBest': r['deltaVsBest'],
                'historicalBestYear': r['historicalBestYear'],
                'weightedUpsideToOwnBest': r['weightedUpsideToOwnBest'],
            }
            for r in regressions
        ],
        'totalWeightedUpsideToOwnBest': round(
            sum(r['weightedUpsideToOwnBest'] or 0 for r in parameter_rows), 2
        ),
    }


def project_scenarios(
    gap: Dict[str, Any],
    own_history: Dict[str, Any],
    peer_rows: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Scenario-based score projections for the briefing (spec 2.17).

    These are arithmetic consequences of closing a stated gap, not forecasts:
    NIRF rescales and reweights, peers move, and the cohort changes every year.
    Every consumer must present these as scenario estimates only, which is why
    the disclaimer travels with the payload rather than living in the UI.
    """
    disclaimer = (
        'Scenario-based estimates only. Each figure is the arithmetic result of '
        'closing the stated gap at current NIRF weights; it is not a predicted '
        'rank. Actual outcomes depend on peer movement and NIRF normalisation.'
    )

    if not gap.get('available'):
        return {'available': False, 'reason': gap.get('reason'), 'disclaimer': disclaimer, 'scenarios': []}

    base = gap.get('recomposedScore') or gap.get('targetScore')
    if base is None:
        return {'available': False, 'reason': 'No current score to project from.',
                'disclaimer': disclaimer, 'scenarios': []}

    scenarios = []

    def rank_for(score):
        """Where a score would have placed in this year's published table."""
        if not peer_rows:
            return None
        better = sum(
            1 for r in peer_rows
            if isinstance(r.get('score'), (int, float)) and r['score'] > score
        )
        return better + 1

    top = (gap.get('priorities') or [])[:1]
    if top:
        p = top[0]
        score = round(base + p['weightedUpsideToBest'], 2)
        scenarios.append({
            'id': 'close-largest-peer-gap',
            'label': f"Match the best peer on {p['label']}",
            'scoreDelta': p['weightedUpsideToBest'],
            'projectedScore': score,
            'wouldHaveRanked': rank_for(score),
        })

    if gap.get('totalWeightedUpside'):
        score = round(base + gap['totalWeightedUpside'], 2)
        scenarios.append({
            'id': 'match-best-peer-everywhere',
            'label': 'Match the best peer on every parameter',
            'scoreDelta': gap['totalWeightedUpside'],
            'projectedScore': score,
            'wouldHaveRanked': rank_for(score),
        })

    if own_history.get('available') and own_history.get('totalWeightedUpsideToOwnBest'):
        score = round(base + own_history['totalWeightedUpsideToOwnBest'], 2)
        scenarios.append({
            'id': 'return-to-own-best',
            'label': "Return to the institute's own best on every parameter",
            'scoreDelta': own_history['totalWeightedUpsideToOwnBest'],
            'projectedScore': score,
            'wouldHaveRanked': rank_for(score),
        })

    return {
        'available': bool(scenarios),
        'baseScore': base,
        'disclaimer': disclaimer,
        'scenarios': scenarios,
    }
