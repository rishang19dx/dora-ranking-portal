import os
import re
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from django.conf import settings

DEFAULT_REQUEST_TEMPLATE = """Dear {{officer}},

The DORA office is compiling the institute's {{framework}} {{cycle}} submission. As the nodal officer for {{section}}, you are requested to provide the following data along with verifiable supporting proof:

{{dataItems}}

Please upload the data and proof documents through your restricted portal link below. The link is personal to you and scoped to {{section}} only:

{{portalLink}}

Submission deadline: {{deadline}}
Request reference: {{reference}}

Regards,
DORA Office
Indian Institute of Technology Mandi"""

DEFAULT_REMINDER_TEMPLATE = """Dear {{officer}},

This is a reminder for data request {{reference}} covering {{section}}. The following items are still awaited:

{{dataItems}}

Your restricted upload link remains active:

{{portalLink}}

Submission deadline: {{deadline}}

Regards,
DORA Office
Indian Institute of Technology Mandi"""

INVITE_TEMPLATE = """Dear {{officer}},

You have been designated as a Nodal Officer for {{sections}} in the IIT Mandi Automated Ranking Portal.

Data requests from the DORA office will reach you by email. Each request carries a personal, time-limited upload link scoped to your section only - no portal account or password is required, and the link cannot be used for any other section.

Portal: {{portal}}

Please keep supporting proof documents ready in PDF, DOCX, XLSX or CSV form.

Regards,
DORA Office
Indian Institute of Technology Mandi"""


def mail_from() -> str:
    return getattr(settings, 'MAIL_FROM', 'DORA Office <dora@iitmandi.ac.in>')


def transport_name() -> str:
    return 'resend' if getattr(settings, 'RESEND_API_KEY', None) else 'outbox'


def render_template(template: str, vars_dict: dict) -> str:
    if not template:
        return ""
    def replacer(match):
        key = match.group(1).strip()
        return str(vars_dict.get(key, match.group(0)))
    return re.sub(r'\{\{\s*([\w.]+)\s*\}\}', replacer, template)


def write_to_outbox(to: str, subject: str, body: str) -> dict:
    try:
        outbox_dir = getattr(settings, 'OUTBOX_DIR', settings.BASE_DIR.parent / '.data' / 'outbox')
        outbox_path = Path(outbox_dir)
        outbox_path.mkdir(parents=True, exist_ok=True)

        now = datetime.now(timezone.utc)
        stamp = now.strftime('%Y-%m-%dT%H-%M-%S-%f')[:-3] + 'Z'
        safe_to = re.sub(r'[^a-zA-Z0-9@._-]', '_', to)
        filename = f"{stamp}__{safe_to}.txt"
        file_path = outbox_path / filename

        rfc2822_date = now.strftime('%a, %d %b %Y %H:%M:%S GMT')
        content = (
            f"From: {mail_from()}\n"
            f"To: {to}\n"
            f"Subject: {subject}\n"
            f"Date: {rfc2822_date}\n\n"
            f"{body}\n"
        )
        file_path.write_text(content, encoding='utf-8')
        return {'status': 'SIMULATED', 'file': str(file_path)}
    except Exception as e:
        return {'status': 'FAILED', 'error': str(e)}


def send_via_resend(to: str, subject: str, body: str) -> dict:
    api_key = getattr(settings, 'RESEND_API_KEY', None)
    if not api_key:
        return {'status': 'FAILED', 'error': 'RESEND_API_KEY is not configured'}

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = json.dumps({
        "from": mail_from(),
        "to": [to],
        "subject": subject,
        "text": body,
    }).encode('utf-8')

    req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status in (200, 201):
                return {'status': 'SENT'}
            return {'status': 'FAILED', 'error': f"HTTP {response.status}"}
    except urllib.error.HTTPError as e:
        error_detail = e.read().decode('utf-8', errors='ignore')
        return {'status': 'FAILED', 'error': f"{e.code} {error_detail[:200]}"}
    except Exception as e:
        return {'status': 'FAILED', 'error': str(e)}


def send_mail(to: str, subject: str, body: str) -> dict:
    if transport_name() == 'resend':
        return send_via_resend(to, subject, body)
    return write_to_outbox(to, subject, body)

