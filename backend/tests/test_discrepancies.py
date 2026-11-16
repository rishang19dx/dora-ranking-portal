"""
Heuristic and AI-assisted discrepancy flagging (spec 2.9) and AI auditability
(spec 9). The AI provider is always mocked at the HTTP boundary.
"""
import json
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.data_requests.models import DataRequest, DataRequestTarget, TargetStatus
from apps.organogram.models import OrgUnit
from apps.submissions import ai_client
from apps.submissions.discrepancies import (
    _ungrounded_numbers,
    ai_review,
    rule_flags_for_submission,
    scan_request,
)
from apps.submissions.models import (
    AIRequestLog,
    DiscrepancyFlag,
    FlagStatus,
    FormSchema,
    SectionSubmission,
    SubmissionAuditLog,
    SubmissionStatus,
)

User = get_user_model()
SECTION = UNIT = 'sponsored-research'


@pytest.fixture
def cycle(db):
    call_command('seed_organogram', verbosity=0)
    call_command('load_form_schema', verbosity=0)
    unit = OrgUnit.objects.get(id=UNIT)

    def make(year, status, payload):
        req = DataRequest.objects.create(
            reference=f'DORA/{year}/NIRF/D', title=f'NIRF {year}', framework='NIRF', cycle_year=year,
            subject='s', message='m', deadline=timezone.now() + timedelta(days=20), data_item_ids=[],
        )
        DataRequestTarget.objects.create(request=req, org_unit=unit, data_item_ids=[], status=TargetStatus.SUBMITTED)
        return SectionSubmission.objects.create(
            request=req, org_unit=unit, section_id=SECTION, schema_version='1.0.0', status=status,
            payload=payload, reviewed_at=timezone.now(),
        )

    make(2026, SubmissionStatus.APPROVED, {'sponsored': {
        'projects': {'2024-25': 50, '2023-24': 45},
        'agencies': {'2024-25': 20, '2023-24': 18},
        'amountReceived': {'2024-25': 10000000, '2023-24': 9000000},
    }})
    current = make(2027, SubmissionStatus.SUBMITTED, {'sponsored': {
        # projects: -80% year on year (spec's own example) -> CRITICAL
        # agencies: +50% year on year -> WARNING
        # amountReceived 2024-25 restated by 10% -> WARNING; 2025-26 +5% -> nothing
        'projects': {'2025-26': 10, '2024-25': 50, '2023-24': 45},
        'agencies': {'2025-26': 30, '2024-25': 20, '2023-24': 18},
        'amountReceived': {'2025-26': 10500000, '2024-25': 11000000, '2023-24': 9000000},
    }})
    return current


def _schema():
    return FormSchema.objects.filter(is_active=True).first().content


def by_field(flags):
    return {(f['path']['rowKey'], f['path']['colKey']): f for f in flags}


def test_rules_grade_year_on_year_moves_and_restatements(cycle):
    flags = by_field(rule_flags_for_submission(cycle, _schema()))
    drop = flags[('projects', '2025-26')]
    assert drop['severity'] == 'CRITICAL' and drop['kind'] == 'YOY_CHANGE'
    assert 'Down 80.0%' in drop['message'] and drop['previous_value'] == '50' and drop['current_value'] == '10'
    assert 'Sponsored' in drop['label'] and '2025-26' in drop['label'], 'labels come from the schema'

    assert flags[('agencies', '2025-26')]['severity'] == 'WARNING'
    restated = flags[('amountReceived', '2024-25')]
    assert restated['kind'] == 'RESTATEMENT' and restated['severity'] == 'WARNING'
    assert ('amountReceived', '2025-26') not in flags, '+5% is unremarkable'
    assert ('projects', '2024-25') not in flags, 'unchanged restatement is not a flag'


def test_drop_to_zero_is_critical(cycle):
    cycle.payload['sponsored']['agencies']['2025-26'] = 0
    cycle.save()
    flag = by_field(rule_flags_for_submission(cycle, _schema()))[('agencies', '2025-26')]
    assert flag['severity'] == 'CRITICAL' and 'Dropped to zero' in flag['message']


def test_thresholds_are_configurable(cycle, settings):
    settings.DISCREPANCY_WARNING_CHANGE_PCT = 60
    flags = by_field(rule_flags_for_submission(cycle, _schema()))
    assert ('agencies', '2025-26') not in flags


def rule_flags(**kw):
    return DiscrepancyFlag.objects.exclude(kind='CROSS_CHECK').filter(**kw)


def test_scan_persists_reconciles_and_auto_resolves(cycle):
    report = scan_request(cycle.request)
    assert rule_flags(request=cycle.request, status=FlagStatus.OPEN).count() == 3
    # Failed cross-checks are raised alongside, institute-wide.
    cross = DiscrepancyFlag.objects.filter(kind='CROSS_CHECK')
    assert report['opened'] == 3 + cross.count()
    assert all(f.submission_id is None for f in cross)

    # Re-scanning is idempotent.
    assert scan_request(cycle.request)['opened'] == 0

    # The department corrects the projects figure: that flag resolves itself.
    cycle.payload['sponsored']['projects']['2025-26'] = 48
    cycle.save()
    report = scan_request(cycle.request)
    assert report['resolved'] == 1
    projects = DiscrepancyFlag.objects.get(request=cycle.request, key__contains=':projects:2025-26')
    assert projects.status == FlagStatus.RESOLVED and 'No longer detected' in projects.resolution_note


def test_dismissed_flag_reopens_only_when_the_figure_changes(cycle):
    scan_request(cycle.request)
    flag = DiscrepancyFlag.objects.get(key__contains=':agencies:2025-26')
    flag.status = FlagStatus.DISMISSED
    flag.resolution_note = 'New MoU with three agencies'
    flag.save()

    scan_request(cycle.request)
    flag.refresh_from_db()
    assert flag.status == FlagStatus.DISMISSED

    cycle.payload['sponsored']['agencies']['2025-26'] = 40
    cycle.save()
    scan_request(cycle.request)
    flag.refresh_from_db()
    assert flag.status == FlagStatus.OPEN and flag.current_value == '40'


def test_drafts_are_not_scanned(cycle):
    cycle.status = SubmissionStatus.DRAFT
    cycle.save()
    scan_request(cycle.request)
    assert not rule_flags().exists()


# ---------------------------------------------------------------------------
# Review actions
# ---------------------------------------------------------------------------

@pytest.fixture
def admin_api(db):
    user = User.objects.create_user(username='dora', email='dora@iitmandi.ac.in', password='x', role='ADMIN')
    client = APIClient()
    client.force_authenticate(user=user)
    client.user = user
    return client


def test_escalate_raises_a_correction_request_with_audit(cycle, admin_api):
    scan_request(cycle.request)
    flag = DiscrepancyFlag.objects.get(key__contains=':projects:2025-26')
    res = admin_api.post(f'/api/nirf/discrepancies/{flag.id}/', {'action': 'escalate'}, format='json')
    assert res.status_code == 200 and res.json()['status'] == 'ESCALATED'

    cycle.refresh_from_db()
    assert cycle.status == SubmissionStatus.CORRECTION_REQUESTED
    assert 'Down 80.0%' in cycle.review_comment
    target = DataRequestTarget.objects.get(request=cycle.request, org_unit_id=UNIT)
    assert target.status == TargetStatus.PARTIAL
    log = SubmissionAuditLog.objects.filter(submission=cycle, action='REQUEST_CORRECTION').get()
    assert log.delta['discrepancyFlag'] == flag.id


def test_escalating_an_approved_return_asks_for_reopen_first(cycle, admin_api):
    scan_request(cycle.request)
    cycle.status = SubmissionStatus.APPROVED
    cycle.save()
    flag = DiscrepancyFlag.objects.get(key__contains=':projects:2025-26')
    res = admin_api.post(f'/api/nirf/discrepancies/{flag.id}/', {'action': 'escalate'}, format='json')
    assert res.status_code == 409 and 'Reopen' in res.json()['error']


def test_dismiss_needs_a_note(cycle, admin_api):
    scan_request(cycle.request)
    flag = DiscrepancyFlag.objects.get(key__contains=':agencies:2025-26')
    url = f'/api/nirf/discrepancies/{flag.id}/'
    assert admin_api.post(url, {'action': 'dismiss'}, format='json').status_code == 400
    ok = admin_api.post(url, {'action': 'dismiss', 'note': 'Confirmed with SRIC'}, format='json')
    assert ok.json()['status'] == 'DISMISSED' and ok.json()['resolvedBy'] == 'dora'
    assert admin_api.post(url, {'action': 'reopen'}, format='json').json()['status'] == 'OPEN'


def test_list_api_shows_summary_and_ai_status(cycle, db):
    scan_request(cycle.request)
    director = User.objects.create_user(username='dir', email='dir@iitmandi.ac.in', password='x', role='DIRECTOR')
    client = APIClient()
    client.force_authenticate(user=director)
    body = client.get(f'/api/nirf/discrepancies/?requestId={cycle.request.id}').json()
    rule = [f for f in body['flags'] if f['kind'] != 'CROSS_CHECK']
    assert sorted(f['severity'] for f in rule) == ['CRITICAL', 'WARNING', 'WARNING']
    assert body['summary']['open'] == len(body['flags'])
    assert body['flags'][0]['severity'] == 'CRITICAL', 'critical first'
    assert body['ai']['configured'] is False and 'AI_PROVIDER' in body['ai']['reason']
    assert client.post('/api/nirf/discrepancies/scan/', {'requestId': cycle.request.id}, format='json').status_code == 403


def test_submitting_a_return_triggers_a_scan(cycle):
    from apps.data_requests.services import issue_grant
    from apps.organogram.models import NodalOfficer, OfficerStatus
    officer = NodalOfficer.objects.create(name='SRIC', email='sric@iitmandi.ac.in', status=OfficerStatus.ACTIVE)
    officer.assigned_units.add(cycle.org_unit)
    _g, token, _u = issue_grant(cycle.request, cycle.org_unit, officer, [])
    cycle.status = SubmissionStatus.DRAFT
    cycle.not_applicable = True  # the simplest return that passes submit validation
    cycle.save()
    with patch('apps.submissions.views.scan_quietly') as scan:
        res = APIClient().post(f'/api/portal/{token}/forms/{SECTION}/submit/', {}, format='json')
    assert res.status_code == 200, res.content
    scan.assert_called_once()
    assert scan.call_args.args[0].pk == cycle.request.pk


def test_a_failing_scan_never_fails_the_submission(cycle):
    from apps.submissions.discrepancies import scan_quietly
    with patch('apps.submissions.discrepancies.scan_request', side_effect=RuntimeError('boom')):
        assert scan_quietly(cycle.request) is None


# ---------------------------------------------------------------------------
# AI layer: generic providers, grounding, logging, fallback
# ---------------------------------------------------------------------------

def _response(json_body, status=200):
    res = MagicMock()
    res.status_code = status
    res.json.return_value = json_body
    res.text = json.dumps(json_body)
    return res


def _reply_for(flags_payload):
    """A well-behaved model reply that reviews every item it was sent."""
    items = flags_payload['items']
    return {'reviews': [
        {'id': i['id'], 'severity': 'CRITICAL' if i['ruleSeverity'] == 'CRITICAL' else 'WARNING',
         'rationale': f"Moved from {i['previous']} to {i['current']}.", 'question': 'Is this figure complete?'}
        for i in items
    ]}


PROVIDERS = {
    'openai': (lambda body: _response({'choices': [{'message': {'content': json.dumps(body)}}]}),
               'https://api.openai.com/v1/chat/completions', 'Authorization'),
    'openrouter': (lambda body: _response({'choices': [{'message': {'content': json.dumps(body)}}]}),
                   'https://openrouter.ai/api/v1/chat/completions', 'Authorization'),
    'anthropic': (lambda body: _response({'content': [{'type': 'text', 'text': json.dumps(body)}]}),
                  'https://api.anthropic.com/v1/messages', 'x-api-key'),
    'gemini': (lambda body: _response({'candidates': [{'content': {'parts': [{'text': json.dumps(body)}]}}]}),
               'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent', 'x-goog-api-key'),
}


@pytest.mark.parametrize('provider', sorted(PROVIDERS))
def test_ai_review_works_with_each_provider(cycle, settings, provider):
    settings.AI_PROVIDER = provider
    settings.AI_API_KEY = 'test-key'
    settings.AI_MODEL = 'gemini-test' if provider == 'gemini' else 'test-model'
    settings.AI_BASE_URL = ''
    scan_request(cycle.request)
    make_response, url, auth_header = PROVIDERS[provider]

    def fake_post(called_url, headers=None, json=None, timeout=None):
        user = json.get('messages', [{}])[-1].get('content') if 'messages' in json else \
            json['contents'][0]['parts'][0]['text']
        if isinstance(user, list):
            user = user[0]['text']
        return make_response(_reply_for(__import__('json').loads(user)))

    with patch.object(ai_client.requests, 'post', side_effect=fake_post) as post:
        report = ai_review(cycle.request)

    assert post.call_args.args[0] == url
    assert 'test-key' in str(post.call_args.kwargs['headers'].get(auth_header))
    sent = DiscrepancyFlag.objects.count()
    assert report['annotated'] == sent and report['rejected'] == 0
    flag = DiscrepancyFlag.objects.get(key__contains=':projects:2025-26')
    assert flag.ai_severity == 'CRITICAL' and 'from 50 to 10' in flag.ai_rationale
    assert flag.severity == 'CRITICAL', 'the rule severity is never overwritten'
    log = AIRequestLog.objects.get()
    assert log.status == 'OK' and log.provider == provider and log.flags_sent == sent


def test_openai_compatible_needs_a_base_url(settings):
    settings.AI_PROVIDER = 'openai-compatible'
    settings.AI_API_KEY = 'k'
    settings.AI_BASE_URL = ''
    assert ai_client.get_config() is None
    assert 'AI_BASE_URL' in ai_client.status()['reason']
    settings.AI_BASE_URL = 'http://llm.internal:8000/v1/'
    settings.AI_MODEL = 'local-model'
    cfg = ai_client.get_config()
    assert cfg.base_url == 'http://llm.internal:8000/v1' and cfg.model == 'local-model'


def test_prompt_carries_no_personal_data(cycle, settings):
    from apps.submissions.models import SubmissionRecord
    SubmissionRecord.objects.create(submission=cycle, block_id='projects', unit_id=UNIT, row_key='x',
                                    data={'coordinator': 'Dr. Secret Person', 'email': 'secret@iitmandi.ac.in'},
                                    position=0)
    settings.AI_PROVIDER, settings.AI_API_KEY = 'openai', 'k'
    scan_request(cycle.request)
    with patch.object(ai_client.requests, 'post', return_value=_response({'choices': [{'message': {'content': '{"reviews": []}'}}]})) as post:
        ai_review(cycle.request)
    sent = json.dumps(post.call_args.kwargs['json'])
    assert 'Secret Person' not in sent and 'secret@' not in sent
    assert 'k' != post.call_args.kwargs['json'].get('api_key')


def test_ungrounded_and_unknown_items_are_rejected(cycle, settings):
    settings.AI_PROVIDER, settings.AI_API_KEY = 'anthropic', 'k'
    scan_request(cycle.request)
    flag = DiscrepancyFlag.objects.get(key__contains=':projects:2025-26')
    reply = {'reviews': [
        {'id': flag.id, 'severity': 'CRITICAL', 'rationale': 'NIRF requires at least 1500 projects.', 'question': 'Why?'},
        {'id': 'flg_invented', 'severity': 'WARNING', 'rationale': 'Something else.', 'question': '?'},
        {'id': flag.id, 'severity': 'BOGUS', 'rationale': 'x', 'question': ''},
    ]}
    with patch.object(ai_client.requests, 'post',
                      return_value=_response({'content': [{'type': 'text', 'text': '```json\n' + json.dumps(reply) + '\n```'}]})):
        report = ai_review(cycle.request)
    assert report['annotated'] == 0 and report['rejected'] == 3
    flag.refresh_from_db()
    assert flag.ai_rationale == ''
    log = AIRequestLog.objects.get()
    assert log.status == 'INVALID' and 'ungrounded figure(s) 1500' in log.error and 'flg_invented' in log.error


def test_provider_failure_falls_back_and_is_logged(cycle, settings):
    settings.AI_PROVIDER, settings.AI_API_KEY = 'gemini', 'k'
    scan_request(cycle.request)
    with patch.object(ai_client.requests, 'post', side_effect=requests.ConnectionError('down')):
        report = ai_review(cycle.request)
    assert 'unavailable' in report['message'] and report['annotated'] == 0
    assert AIRequestLog.objects.get().status == 'ERROR'
    assert rule_flags(status=FlagStatus.OPEN).count() == 3, 'rule flags unaffected'

    with patch.object(ai_client.requests, 'post', return_value=_response({'error': 'quota'}, status=429)):
        assert 'HTTP 429' in ai_review(cycle.request)['error']


def test_no_provider_means_no_call(cycle, settings):
    settings.AI_PROVIDER = ''
    scan_request(cycle.request)
    with patch.object(ai_client.requests, 'post') as post:
        report = ai_review(cycle.request)
    assert report['configured'] is False and not post.called and not AIRequestLog.objects.exists()


def test_scan_endpoint_runs_ai_when_asked(cycle, settings, admin_api):
    settings.AI_PROVIDER, settings.AI_API_KEY = 'openai', 'k'
    with patch.object(ai_client.requests, 'post',
                      return_value=_response({'choices': [{'message': {'content': '{"reviews": []}'}}]})):
        body = admin_api.post('/api/nirf/discrepancies/scan/', {'requestId': cycle.request.id, 'useAi': True},
                              format='json').json()
    assert body['ai']['sent'] == body['scan']['opened'] == DiscrepancyFlag.objects.count()


def test_ai_log_api_is_admin_and_auditor_only(cycle, settings, admin_api):
    settings.AI_PROVIDER, settings.AI_API_KEY = 'openai', 'k'
    scan_request(cycle.request)
    with patch.object(ai_client.requests, 'post', side_effect=requests.Timeout()):
        ai_review(cycle.request, user=admin_api.user)
    rows = admin_api.get('/api/ai/requests/').json()
    assert rows[0]['status'] == 'ERROR' and rows[0]['triggeredBy'] == 'dora'
    assert rows[0]['prompt']['user']['items'][0]['id'].startswith('flg_')
    director = User.objects.create_user(username='d2', email='d2@iitmandi.ac.in', password='x', role='DIRECTOR')
    c = APIClient()
    c.force_authenticate(user=director)
    assert c.get('/api/ai/requests/').status_code == 403


def test_grounding_check_unit():
    allowed = {'50', '10', '80.0', '80', '2025', '2024', '25'}
    assert _ungrounded_numbers('Fell from 50 to 10 in 2025-26 (80%).', allowed) == []
    assert _ungrounded_numbers('The NIRF median is 1,200.', allowed) == ['1,200']


def test_parse_json_tolerates_fences_and_prose():
    assert ai_client.parse_json('Here you go:\n```json\n{"reviews": []}\n```') == {'reviews': []}
    assert ai_client.parse_json('Sure! {"reviews": [1]} Hope it helps') == {'reviews': [1]}
    with pytest.raises(ai_client.AIError):
        ai_client.parse_json('no json here')


def test_briefing_lists_outstanding_trend_flags(cycle, admin_api, monkeypatch):
    from reportlab import rl_config
    monkeypatch.setattr(rl_config, 'pageCompression', 0)  # so the text is searchable
    scan_request(cycle.request)
    res = admin_api.get(f'/api/nirf/cycles/2027/briefing/?requestId={cycle.request.id}')
    assert res.status_code == 200
    assert rb'historical-trend flag\(s\) outstanding \(1 critical\)' in res.content
