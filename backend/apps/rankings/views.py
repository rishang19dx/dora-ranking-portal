from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.accounts.permissions import IsAdmin, IsAdminOrOversightReadOnly
from .scraper import (  # noqa: F401 - DATA_DIR is re-exported for test fixtures that patch it
    fetch_lock,
    refresh_new_publications,
    scrape_nirf_data,
    DATA_DIR,
    TARGET_IITS,
    clean_institute_name,
    canonical_iit_name
)
from .store import (
    available_years,
    get_cache_file,
    latest_year,
    load_ranking_data,
    trend_window,
)
from .analytics import (
    PARAMETER_LABELS,
    PARAMETER_ORDER,
    PARAMETER_WEIGHTS,
    PARAMETRIC_CATEGORIES,
    compute_gap_analysis,
    compute_own_history_gap,
    compute_parameter_trends,
    project_scenarios,
)
from .models import RankingRecord, RankingRecordStatus, RankingAuditLog
from .serializers import RankingRecordSerializer, RankingAuditLogSerializer


def ranking_log(record, actor, action, delta=None):
    RankingAuditLog.objects.create(ranking=record, actor=actor, action=action, delta=delta or {})


def is_privileged(user):
    return user.is_staff or user.is_superuser or getattr(user, 'role', None) in ['ADMIN', 'DIRECTOR']

def resolve_year_range(params, category: str):
    """
    Resolve the selectable time range for a dashboard (spec 2.15).

    Accepts `from`/`to` bounds or `last=N` for the most recent N years, and
    falls back to everything available. Returns (years, error_message).
    """
    years = available_years(category)
    if not years:
        return [], f"No cached {category} datasets are available."

    def as_int(name):
        raw = params.get(name)
        if raw in (None, ''):
            return None, None
        try:
            return int(raw), None
        except (TypeError, ValueError):
            return None, f"'{name}' must be a year."

    y_from, err = as_int('from')
    if err:
        return [], err
    y_to, err = as_int('to')
    if err:
        return [], err
    last, err = as_int('last')
    if err:
        return [], err

    if y_from is not None:
        years = [y for y in years if y >= y_from]
    if y_to is not None:
        years = [y for y in years if y <= y_to]
    if last is not None:
        if last < 1:
            return [], "'last' must be at least 1."
        years = years[-last:]

    if not years:
        return [], 'The requested range contains no cached datasets.'
    return years, None

class RootRankingWelcomeView(APIView):
    permission_classes = [AllowAny]  # published NIRF results: public portal (spec 2.14)

    def get(self, request):
        return Response({
            "message": "Welcome to the NIRF Rankings API (Django DRF).",
            "endpoints": [
                "/api/v1/rankings/<year>/<category>/",
                "/api/v1/rankings/<year>/<category>/2nd-gen-iits/",
                "/api/v1/rankings/<year>/<category>/<rank>/",
                "/api/v1/rankings/trends/",
                "/api/v1/rankings/parameters/trends/",
                "/api/v1/rankings/gap-analysis/",
                "/api/v1/scraper/update/",
            ]
        })

class GetRankingsView(APIView):
    permission_classes = [AllowAny]  # published NIRF results: public portal (spec 2.14)

    def get(self, request, year, category):
        try:
            year_int = int(year)
        except ValueError:
            return Response({"error": "Invalid year format."}, status=status.HTTP_400_BAD_REQUEST)

        data = load_ranking_data(year_int, category)
        if data is None:
            return Response(
                {"error": f"Data not found for year {year} and category {category}."},
                status=status.HTTP_404_NOT_FOUND
            )

        filtered = data
        state = request.query_params.get('state')
        city = request.query_params.get('city')
        limit = request.query_params.get('limit')

        if state:
            filtered = [item for item in filtered if state.lower() in item.get('state', '').lower()]
        if city:
            filtered = [item for item in filtered if city.lower() in item.get('city', '').lower()]
        if limit and limit.isdigit():
            filtered = filtered[:int(limit)]

        return Response({
            "count": len(filtered),
            "data": filtered
        })

class GetSecondGenIITsView(APIView):
    permission_classes = [AllowAny]  # published NIRF results: public portal (spec 2.14)

    TARGET_IITS = TARGET_IITS

    def get(self, request, year, category):
        try:
            year_int = int(year)
        except ValueError:
            return Response({"error": "Invalid year format."}, status=status.HTTP_400_BAD_REQUEST)

        data = load_ranking_data(year_int, category)
        if data is None:
            return Response(
                {"error": f"Data not found for year {year} and category {category}."},
                status=status.HTTP_404_NOT_FOUND
            )

        filtered = []
        for item in data:
            c_name = canonical_iit_name(item.get('name', ''))
            if c_name in self.TARGET_IITS:
                item_copy = dict(item)
                item_copy['canonical_name'] = c_name
                filtered.append(item_copy)

        return Response({
            "count": len(filtered),
            "data": filtered
        })

class GetRankingByRankView(APIView):
    permission_classes = [AllowAny]  # published NIRF results: public portal (spec 2.14)

    def get(self, request, year, category, rank):
        try:
            year_int = int(year)
        except ValueError:
            return Response({"error": "Invalid year format."}, status=status.HTTP_400_BAD_REQUEST)

        data = load_ranking_data(year_int, category)
        if data is None:
            return Response(
                {"error": f"Data not found for year {year} and category {category}."},
                status=status.HTTP_404_NOT_FOUND
            )

        parsed_rank = int(rank) if rank.isdigit() else rank
        for item in data:
            if item.get('rank') == parsed_rank:
                return Response(item)

        return Response(
            {"error": f"Institution with rank {rank} not found."},
            status=status.HTTP_404_NOT_FOUND
        )

class TrendsAnalyticsView(APIView):
    """
    Returns 5-year longitudinal trend data for 2nd Gen IITs
    across Engineering, Innovation, and Overall categories.
    """
    permission_classes = [AllowAny]  # published NIRF results: public portal (spec 2.14)

    WINDOW = 5  # most recent published cycles shown
    CATEGORIES = ['Engineering', 'Innovation', 'Overall']

    SHORT_NAMES = {
        "Indian Institute of Technology Mandi": "IIT Mandi",
        "Indian Institute of Technology Hyderabad": "IIT Hyderabad",
        "Indian Institute of Technology Indore": "IIT Indore",
        "Indian Institute of Technology Gandhinagar": "IIT Gandhinagar",
        "Indian Institute of Technology Ropar": "IIT Ropar",
        "Indian Institute of Technology Patna": "IIT Patna",
        "Indian Institute of Technology Jodhpur": "IIT Jodhpur",
        "Indian Institute of Technology Bhubaneswar": "IIT Bhubaneswar",
    }

    def get(self, request):
        # The window follows whatever NIRF has published and the refresh job
        # has cached - no year is assumed to be the latest.
        years = trend_window(self.CATEGORIES, self.WINDOW)
        category_param = request.query_params.get('category')
        active_cats = [category_param.capitalize()] if category_param and category_param.capitalize() in self.CATEGORIES else self.CATEGORIES

        iit_mandi_trends = {}
        peer_comparison = {}

        for cat in active_cats:
            cat_lower = cat.lower()
            mandi_yearly = []

            # Structure peer map: canonical_name -> { "ranks": {}, "scores": {}, ... }
            peers_map = {
                t_name: {
                    "institute": t_name,
                    "short_name": self.SHORT_NAMES.get(t_name, t_name),
                    "is_target": (t_name == "Indian Institute of Technology Mandi"),
                    "ranks": {},
                    "scores": {},
                    "latest_rank": None,
                    "latest_score": None,
                }
                for t_name in TARGET_IITS
            }

            cat_latest = latest_year(cat)
            for y in years:
                data = load_ranking_data(y, cat_lower) or []
                for item in data:
                    c_name = canonical_iit_name(item.get('name', ''))
                    if c_name in peers_map:
                        rk = item.get('rank')
                        sc = item.get('score')
                        peers_map[c_name]["ranks"][str(y)] = rk
                        peers_map[c_name]["scores"][str(y)] = sc
                        if y == cat_latest:
                            peers_map[c_name]["latest_rank"] = rk
                            peers_map[c_name]["latest_score"] = sc

                        if c_name == "Indian Institute of Technology Mandi":
                            mandi_yearly.append({
                                "year": y,
                                "rank": rk,
                                "score": sc,
                                "parameters": item.get('parameters'),
                                "city": item.get('city'),
                                "state": item.get('state'),
                            })

            # Calculate YoY movement for Mandi
            mandi_yearly.sort(key=lambda x: x['year'])
            for idx, item in enumerate(mandi_yearly):
                if idx > 0:
                    prev = mandi_yearly[idx - 1]
                    item['previous_rank'] = prev['rank']
                    if isinstance(item['rank'], (int, float)) and isinstance(prev['rank'], (int, float)):
                        item['rank_change'] = prev['rank'] - item['rank']
                    else:
                        item['rank_change'] = 0
                else:
                    item['previous_rank'] = None
                    item['rank_change'] = 0

            iit_mandi_trends[cat] = mandi_yearly

            # Convert peers_map to sorted list (target first, then by latest rank ascending)
            peer_list = list(peers_map.values())
            peer_list.sort(key=lambda p: (
                0 if p['is_target'] else 1,
                p['latest_rank'] if isinstance(p['latest_rank'], (int, float)) else 999
            ))
            peer_comparison[cat] = peer_list

        return Response({
            "years": years,
            "latestYear": years[-1] if years else None,
            "categories": self.CATEGORIES,
            "target_institute": "Indian Institute of Technology Mandi",
            "iit_mandi_trends": iit_mandi_trends,
            "peer_comparison": peer_comparison,
        })


class ParameterTrendsView(APIView):
    """
    IIT Mandi's parameter-level history (TLR, RPC, GO, OI, Perception).

    The headline rank says the institute moved; this says which of the five
    scored parameters moved it, and what each one contributed to the total.
    Published NIRF results, so no authentication - same as the rank endpoints.
    """
    permission_classes = [AllowAny]  # published NIRF results: public portal (spec 2.14)

    def get(self, request):
        requested = request.query_params.get('category')
        if requested:
            match = next(
                (c for c in PARAMETRIC_CATEGORIES if c.lower() == requested.lower()),
                None,
            )
            if match is None:
                return Response(
                    {
                        'error': (
                            f"NIRF does not publish parameter sub-scores for "
                            f"'{requested}'. Available: "
                            f"{', '.join(PARAMETRIC_CATEGORIES)}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            categories = [match]
        else:
            categories = list(PARAMETRIC_CATEGORIES)

        trends = {}
        years_used = []
        for cat in categories:
            years, err = resolve_year_range(request.query_params, cat)
            if err:
                return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
            years_used = years
            trends[cat] = compute_parameter_trends(load_ranking_data, cat, years)

        return Response({
            'years': years_used,
            'availableYears': available_years(categories[0]),
            'categories': categories,
            'parameterOrder': PARAMETER_ORDER,
            'labels': PARAMETER_LABELS,
            'weights': PARAMETER_WEIGHTS,
            'trends': trends,
        })

class GapAnalysisView(APIView):
    """
    Where IIT Mandi is losing score against its 2nd-generation IIT peers.

    Each parameter carries the gap to the best peer and - the part leadership
    acts on - the weighted points the total score would gain by closing it,
    so the rows are directly comparable rather than five raw deltas.
    """
    permission_classes = [AllowAny]  # published NIRF results: public portal (spec 2.14)

    def get(self, request):
        requested_year = request.query_params.get('year')
        if requested_year in (None, ''):
            # Default to the newest published cycle on disk.
            year = latest_year('Engineering')
            if year is None:
                return Response({'error': 'No ranking data has been fetched yet.'},
                                status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                year = int(requested_year)
            except (TypeError, ValueError):
                return Response(
                    {'error': 'Invalid year.'}, status=status.HTTP_400_BAD_REQUEST
                )

        requested = request.query_params.get('category')
        if requested:
            match = next(
                (c for c in PARAMETRIC_CATEGORIES if c.lower() == requested.lower()),
                None,
            )
            categories = [match or requested.capitalize()]
        else:
            categories = list(PARAMETRIC_CATEGORIES)

        include_scenarios = request.query_params.get('scenarios', '1') in ('1', 'true', 'yes')

        analysis = {}
        for cat in categories:
            years = available_years(cat) or [year]
            peer_gap = compute_gap_analysis(
                load_ranking_data, canonical_iit_name, TARGET_IITS, cat, year
            )
            own_gap = compute_own_history_gap(load_ranking_data, cat, year, years)
            entry = {
                'vsPeers': peer_gap,
                'vsOwnHistory': own_gap,
            }
            if include_scenarios:
                entry['projections'] = project_scenarios(
                    peer_gap, own_gap, load_ranking_data(year, cat.lower()) or []
                )
            analysis[cat] = entry

        return Response({
            'year': year,
            'categories': categories,
            'parameterOrder': PARAMETER_ORDER,
            'labels': PARAMETER_LABELS,
            'weights': PARAMETER_WEIGHTS,
            'analysis': analysis,
        })

class TriggerScraperUpdateView(APIView):
    """
    Explicit "fetch now" for DORA staff, alongside the daily schedule.

    By default only cycles not yet cached are requested - at most a request
    per category, so it answers quickly even inside a web worker's timeout.
    `full=true` re-fetches every year (slow; the management command
    `refresh_rankings --full` is the better tool for that).

    Staff only: this was previously open to anyone, and the button sat on
    the public trends page.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        full = str(request.data.get('full', request.query_params.get('full', ''))).lower() in ('1', 'true', 'yes')
        report = {}
        with fetch_lock() as acquired:
            if not acquired:
                return Response(
                    {'error': 'A ranking fetch is already running. Try again in a minute.'},
                    status=status.HTTP_409_CONFLICT,
                )
            ok = scrape_nirf_data(report=report) if full else refresh_new_publications(report=report)

        fetched = [{'year': y, 'category': c, 'institutions': n} for y, c, n in report.get('fetched', [])]
        pending = [{'year': y, 'category': c} for y, c in report.get('unpublished', [])]
        failed = [{'year': y, 'category': c} for y, c in report.get('failed', [])]

        if fetched:
            cycles = sorted({f['year'] for f in fetched})
            message = f"Fetched NIRF {', '.join(map(str, cycles))}."
        elif failed:
            message = 'Could not reach the NIRF site; nothing new was fetched.'
        else:
            message = 'Already up to date: no new NIRF cycle has been published.'

        body = {
            'message': message,
            'mode': 'full' if full else 'new-only',
            'fetched': fetched,
            'notPublishedYet': pending,
            'failed': failed,
            'latestYear': latest_year('Engineering'),
        }
        code = status.HTTP_502_BAD_GATEWAY if (failed and not fetched and not ok) else status.HTTP_200_OK
        return Response(body, status=code)


class RankingRecordListCreateView(APIView):
    """Published records are public; logged-in staff see workflow records too."""
    permission_classes = [AllowAny]

    def get(self, request):
        records = RankingRecord.objects.all()
        if not request.user.is_authenticated:
            records = records.filter(status=RankingRecordStatus.PUBLISHED)
            data = RankingRecordSerializer(records, many=True, context={'request': request}).data
            # Supporting evidence and workflow identities remain internal even after publication.
            for record in data:
                for field in ('evidence', 'evidence_url', 'submitted_by', 'submitted_by_name', 'reviewed_by', 'reviewed_by_name', 'review_comment'):
                    record.pop(field, None)
            return Response(data)
        elif getattr(request.user, 'role', None) == 'NODAL_OFFICER' and not is_privileged(request.user):
            records = records.filter(submitted_by=request.user)
        return Response(RankingRecordSerializer(records, many=True, context={'request': request}).data)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = RankingRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = serializer.save(submitted_by=request.user)
        ranking_log(record, request.user, 'CREATE', {'status': record.status})
        return Response(RankingRecordSerializer(record, context={'request': request}).data, status=status.HTTP_201_CREATED)


class RankingRecordDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return RankingRecord.objects.get(pk=pk)
        except RankingRecord.DoesNotExist:
            return None

    def get(self, request, pk):
        record = self.get_object(pk)
        if not record:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not (is_privileged(request.user) or getattr(request.user, 'role', None) == 'AUDITOR' or record.submitted_by_id == request.user.id):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(RankingRecordSerializer(record, context={'request': request}).data)

    def patch(self, request, pk):
        record = self.get_object(pk)
        if not record:
            return Response(status=status.HTTP_404_NOT_FOUND)
        editable = record.submitted_by_id == request.user.id and record.status in [RankingRecordStatus.DRAFT, RankingRecordStatus.REJECTED]
        if not (is_privileged(request.user) or editable):
            return Response({'detail': 'Only draft/rejected records may be edited by their submitting officer.'}, status=status.HTTP_403_FORBIDDEN)
        before = {k: getattr(record, k) for k in ['agency', 'category', 'year', 'rank', 'source_url', 'remarks']}
        serializer = RankingRecordSerializer(record, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        ranking_log(record, request.user, 'UPDATE', {'before': before})
        return Response(RankingRecordSerializer(record, context={'request': request}).data)


class RankingRecordActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, action):
        try:
            record = RankingRecord.objects.get(pk=pk)
        except RankingRecord.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        user = request.user
        role = getattr(user, 'role', None)
        comment = request.data.get('comment', '')
        if action == 'submit' and record.submitted_by_id == user.id and record.status in [RankingRecordStatus.DRAFT, RankingRecordStatus.REJECTED]:
            record.status, record.submitted_at = RankingRecordStatus.PENDING_REVIEW, timezone.now()
        elif action == 'verify' and role == 'AUDITOR' and record.status == RankingRecordStatus.PENDING_REVIEW:
            record.status, record.reviewed_by, record.reviewed_at, record.review_comment = RankingRecordStatus.VERIFIED, user, timezone.now(), comment
        elif action == 'reject' and (role == 'AUDITOR' or is_privileged(user)) and record.status == RankingRecordStatus.PENDING_REVIEW:
            record.status, record.reviewed_by, record.reviewed_at, record.review_comment = RankingRecordStatus.REJECTED, user, timezone.now(), comment
        elif action == 'publish' and is_privileged(user) and record.status == RankingRecordStatus.VERIFIED:
            record.status, record.published_by, record.published_at = RankingRecordStatus.PUBLISHED, user, timezone.now()
        elif action == 'unpublish' and is_privileged(user) and record.status == RankingRecordStatus.PUBLISHED:
            record.status = RankingRecordStatus.VERIFIED
        else:
            return Response({'detail': 'Action is not permitted in the current workflow state.'}, status=status.HTTP_403_FORBIDDEN)
        record.save()
        ranking_log(record, user, action.upper(), {'comment': comment, 'status': record.status})
        return Response(RankingRecordSerializer(record, context={'request': request}).data)


class RankingRecordAuditView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, pk):
        if not (is_privileged(request.user) or getattr(request.user, 'role', None) == 'AUDITOR'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(RankingAuditLogSerializer(RankingAuditLog.objects.filter(ranking_id=pk), many=True).data)


# -----------------------------------------------------------------------------
# Public ranking portal across systems (spec 2.14)
# -----------------------------------------------------------------------------

def _nirf_series(category):
    """IIT Mandi's NIRF rank per cached year for one category."""
    from .analytics import TARGET_INSTITUTE
    from .models import parse_rank

    points = []
    for year in available_years(category):
        rows = load_ranking_data(year, category) or []
        row = next((r for r in rows if r.get('name') == TARGET_INSTITUTE), None)
        if not row or row.get('rank') in (None, ''):
            continue
        try:
            low, high = parse_rank(str(row['rank']))
        except ValueError:
            continue
        points.append({
            'year': year,
            'rankText': str(row['rank']),
            'rankLow': low,
            'rankHigh': high,
            'plotRank': low if high is None else (low + high) / 2,
            'score': row.get('score'),
            'source': 'https://www.nirfindia.org',
            'demo': False,
        })
    return points


def _serialize_external(r):
    return {
        'id': r.id,
        'system': r.system,
        'systemLabel': r.system_label,
        'label': r.label,
        'year': r.year,
        'rankText': r.rank_text,
        'rankLow': r.rank_low,
        'rankHigh': r.rank_high,
        'plotRank': r.plot_rank,
        'score': r.score,
        'source': r.source_url,
        'notes': r.notes,
        'published': r.published,
        'demo': r.is_demo,
        'updatedAt': r.updated_at,
    }


class PublicRankingSystemsView(APIView):
    """
    IIT Mandi's year-wise position in every ranking system DORA tracks, for the
    public portal (no login). NIRF comes straight from the published tables;
    other systems from results DORA has entered and marked published.
    Lower rank is better in every series.
    """
    permission_classes = [AllowAny]  # public portal (spec 2.14)

    def get(self, request):
        from .models import ExternalRankingResult

        systems = []
        for category in CATEGORIES_FOR_PUBLIC:
            series = _nirf_series(category)
            if series:
                systems.append({
                    'id': f'NIRF_{category.upper()}',
                    'label': f'NIRF {category}',
                    'family': 'NIRF',
                    'series': series,
                })

        external = ExternalRankingResult.objects.filter(published=True).order_by('system', 'system_label', 'year')
        grouped = {}
        for r in external:
            key = (r.system, r.system_label if r.system == 'OTHER' else '')
            grouped.setdefault(key, []).append(r)
        for (system, other_label), rows in grouped.items():
            systems.append({
                'id': system if not other_label else f'OTHER:{other_label}',
                'label': rows[0].label,
                'family': system.split('_')[0],
                'series': [
                    {k: v for k, v in _serialize_external(r).items()
                     if k in ('year', 'rankText', 'rankLow', 'rankHigh', 'plotRank', 'score', 'source', 'demo')}
                    for r in rows
                ],
            })

        return Response({
            'institute': 'IIT Mandi',
            'lowerIsBetter': True,
            'hasDemoData': any(p['demo'] for s in systems for p in s['series']),
            'systems': systems,
        })


CATEGORIES_FOR_PUBLIC = ('Overall', 'Engineering', 'Innovation')


class ExternalRankingListView(APIView):
    """DORA-maintained results for non-NIRF systems. Oversight reads, Admin edits."""
    permission_classes = [IsAdminOrOversightReadOnly]

    def get(self, request):
        from .models import ExternalRankingResult, RankingSystem
        return Response({
            'systems': [{'value': v, 'label': lbl} for v, lbl in RankingSystem.choices],
            'results': [_serialize_external(r) for r in ExternalRankingResult.objects.all()],
        })

    def post(self, request):
        return _save_external(None, request.data)


class ExternalRankingDetailView(APIView):
    permission_classes = [IsAdminOrOversightReadOnly]

    def patch(self, request, pk):
        from .models import ExternalRankingResult
        try:
            row = ExternalRankingResult.objects.get(pk=pk)
        except ExternalRankingResult.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return _save_external(row, request.data)

    def delete(self, request, pk):
        from .models import ExternalRankingResult
        deleted, _ = ExternalRankingResult.objects.filter(pk=pk).delete()
        if not deleted:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _save_external(row, data):
    from django.db import IntegrityError, transaction
    from .models import ExternalRankingResult, RankingSystem, parse_rank

    row = row or ExternalRankingResult()
    errors = {}
    fields = {
        'system': data.get('system', row.system or None),
        'system_label': (data.get('systemLabel', row.system_label) or '').strip(),
        'rank_text': (data.get('rankText', row.rank_text) or '').strip(),
        'source_url': (data.get('source', row.source_url) or '').strip(),
        'notes': data.get('notes', row.notes) or '',
    }
    if fields['system'] not in RankingSystem.values:
        errors['system'] = 'Choose a ranking system.'
    elif fields['system'] == RankingSystem.OTHER and not fields['system_label']:
        errors['systemLabel'] = 'Name the ranking system.'
    if fields['system'] != RankingSystem.OTHER:
        fields['system_label'] = ''
    try:
        year = int(data.get('year', row.year))
        if not 2000 <= year <= 2100:
            raise ValueError
        fields['year'] = year
    except (TypeError, ValueError):
        errors['year'] = 'Enter the edition year.'
    try:
        parse_rank(fields['rank_text'])
    except ValueError as exc:
        errors['rankText'] = str(exc)
    score = data.get('score', row.score)
    if score in ('', None):
        fields['score'] = None
    else:
        try:
            fields['score'] = float(score)
        except (TypeError, ValueError):
            errors['score'] = 'Score must be a number.'
    if fields['source_url'] and not fields['source_url'].startswith(('http://', 'https://')):
        errors['source'] = 'The source must be a web link.'
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    for k, v in fields.items():
        setattr(row, k, v)
    if 'published' in data:
        row.published = str(data['published']).lower() in ('1', 'true', 'yes')
    # A figure an admin enters or edits is real data, even on a former demo
    # row; merely hiding or showing a row changes nothing about its origin.
    if row.pk is None or any(k in data for k in ('system', 'systemLabel', 'year', 'rankText', 'score', 'source')):
        row.is_demo = False
    created = row.pk is None
    try:
        with transaction.atomic():
            row.save()
    except IntegrityError:
        return Response({'year': 'This system already has a result for that year.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(_serialize_external(row), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
