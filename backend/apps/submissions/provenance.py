"""
Proof provenance and versioning (spec 2.4).

Every data point must trace to its source proof: an auditor looking at a
"Sponsored Research" figure needs the sanction PDFs behind it. The link runs
through the schema - a section declares the catalogue items it collects
(`catalogueItemIds`), and every proof is uploaded against a catalogue item for
a specific request and unit. So the proofs behind a submission are those
uploaded for the same request and unit against one of its catalogue items.

Proofs are append-only - a corrected file is uploaded alongside, never over,
the original - so versions are the upload order within one (request, unit,
item). The newest is current; earlier ones are retained history.
"""

from collections import defaultdict
from typing import Dict, Iterable, List, Optional

from apps.data_requests.models import ProofUpload


def proof_download_url(proof: ProofUpload) -> str:
    return f'/api/proofs/{proof.id}/download/'


def annotate_versions(proofs: Iterable[ProofUpload]) -> List[Dict]:
    """Serialise proofs with their version number within each evidence slot."""
    proofs = list(proofs)
    slots: Dict[tuple, List[ProofUpload]] = defaultdict(list)
    for p in proofs:
        slots[(p.request_id, p.org_unit_id, p.data_item_id)].append(p)

    version_of: Dict[str, tuple] = {}
    for slot in slots.values():
        ordered = sorted(slot, key=lambda p: (p.uploaded_at, p.id))
        for index, p in enumerate(ordered, start=1):
            version_of[p.id] = (index, len(ordered))

    out = []
    for p in proofs:
        version, total = version_of[p.id]
        out.append({
            'id': p.id,
            'requestId': p.request_id,
            'requestReference': getattr(p.request, 'reference', None),
            'cycleYear': getattr(p.request, 'cycle_year', None),
            'unitId': p.org_unit_id,
            'unitName': getattr(p.org_unit, 'name', None),
            'dataItemId': p.data_item_id,
            'fileName': p.file_name,
            'size': p.size,
            'contentType': p.content_type,
            'checksum': p.checksum,
            'note': p.note or '',
            'uploadedAt': p.uploaded_at.isoformat(),
            'uploadedBy': getattr(p.officer, 'name', None),
            'version': version,
            'versionCount': total,
            'isLatest': version == total,
            'downloadUrl': proof_download_url(p),
        })
    return out


def sections_for_item(schema: Optional[dict], data_item_id: str) -> List[Dict]:
    """The schema sections a catalogue item is evidence for."""
    return [
        {'sectionId': s['id'], 'title': s.get('title', s['id'])}
        for s in (schema or {}).get('sections', [])
        if data_item_id in (s.get('catalogueItemIds') or [])
    ]


def proofs_for_submission(submission, section_def: Optional[dict]) -> List[Dict]:
    """The proofs that evidence one section submission, newest first."""
    item_ids = list((section_def or {}).get('catalogueItemIds') or [])
    if not item_ids:
        return []
    qs = (
        ProofUpload.objects
        .filter(request_id=submission.request_id,
                org_unit_id=submission.org_unit_id,
                data_item_id__in=item_ids)
        .select_related('request', 'org_unit', 'officer')
        .order_by('-uploaded_at')
    )
    return annotate_versions(qs)
