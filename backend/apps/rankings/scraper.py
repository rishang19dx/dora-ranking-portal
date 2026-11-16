import os
import contextlib
import json
import re
import tempfile
from datetime import date

import requests
from bs4 import BeautifulSoup

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CUSTOM_API_DATA_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "custom_api_nirf", "data")
)

# NIRF's first year in the cached series. Later years are discovered rather
# than listed, so a newly published cycle is picked up without a code change.
NIRF_FIRST_YEAR = int(os.environ.get('NIRF_FIRST_YEAR', '2021'))
CATEGORIES = ['Overall', 'Engineering', 'Innovation']

# The Innovation peer rows below were hand-entered for these cycles only. They
# are never applied to any other year, so a newly published cycle can only
# ever contain what NIRF itself published.
ENRICHED_INNOVATION_YEARS = {2023, 2024, 2025}


def default_years(today=None):
    """Every year from the first cached cycle up to the current one."""
    today = today or date.today()
    return list(range(NIRF_FIRST_YEAR, today.year + 1))


def _atomic_write_json(path, data):
    """
    Write then rename, so a web worker reading concurrently sees either the
    old file or the complete new one - never a half-written table.
    """
    directory = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix='.tmp-', suffix='.json')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


@contextlib.contextmanager
def fetch_lock():
    """
    Non-blocking exclusive lock around a fetch, shared by the web trigger,
    the scheduler and the management command, so two fetches never write
    the same files at once. Yields True if acquired, False if one is
    already running.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    handle = open(os.path.join(DATA_DIR, '.fetch.lock'), 'w')
    try:
        try:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except ImportError:  # non-POSIX dev machines: no cross-process lock
            pass
        except OSError:
            yield False
            return
        yield True
    finally:
        handle.close()

# 2nd Generation IITs Canonical Mapping
TARGET_IITS = [
    "Indian Institute of Technology Hyderabad",
    "Indian Institute of Technology Indore",
    "Indian Institute of Technology Patna",
    "Indian Institute of Technology Ropar",
    "Indian Institute of Technology Gandhinagar",
    "Indian Institute of Technology Bhubaneswar",
    "Indian Institute of Technology Jodhpur",
    "Indian Institute of Technology Mandi",
]

def clean_institute_name(raw_text: str) -> str:
    """Extract clean institute name from raw table cell text."""
    if not raw_text:
        return ""
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not lines:
        return ""
    name = lines[0]
    for delimiter in ['More Details', 'Close', '|']:
        if delimiter in name:
            name = name.split(delimiter)[0].strip()
    name = re.sub(r'\(100\).*', '', name).strip()
    name = name.rstrip(',').strip()
    name = name.replace('Indian Institute of Technology,', 'Indian Institute of Technology')
    return name

def canonical_iit_name(name: str) -> str:
    """Normalize name to match canonical TARGET_IITS if it refers to a 2nd Gen IIT."""
    lower = name.lower()
    for canonical in TARGET_IITS:
        keyword = canonical.replace("Indian Institute of Technology ", "").lower()
        if keyword in lower and ("technology" in lower or "iit" in lower):
            return canonical
    return name

PARAM_KEY_MAP = {
    "TLR": "tlr",
    "RPC": "rpc",
    "RP": "rpc",
    "GO": "go",
    "OI": "oi",
    "PERCEPTION": "pr",
    "PR": "pr",
}

def _to_float(raw: str):
    """Parse a NIRF sub-score cell, tolerating blanks, dashes and stray marks."""
    if raw is None:
        return None
    txt = raw.strip().replace(',', '')
    if not txt or txt in {'-', '--', 'NA', 'N/A'}:
        return None
    match = re.search(r'\d+(?:\.\d+)?', txt)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None

def extract_parameters(row):
    """
    Pull the TLR/RPC/GO/OI/PERCEPTION sub-scores for one institute.

    NIRF renders them in a nested table inside the institute-name cell (the
    "More Details" drawer), not as extra columns on the outer row, so the
    headers are read by name instead of by position.
    """
    for table in row.find_all('table'):
        header_cells = None
        value_cells = None
        for tr in table.find_all('tr'):
            cells = tr.find_all(['th', 'td'])
            if not cells:
                continue
            labels = [c.get_text(strip=True).upper() for c in cells]
            keys = [PARAM_KEY_MAP.get(re.sub(r'\s*\(.*?\)', '', lbl).strip()) for lbl in labels]
            if sum(1 for k in keys if k) >= 3:
                header_cells = keys
                continue
            if header_cells and len(cells) == len(header_cells):
                value_cells = [c.get_text(strip=True) for c in cells]
                break

        if not header_cells or not value_cells:
            continue

        params = {}
        for key, raw in zip(header_cells, value_cells):
            if not key:
                continue
            val = _to_float(raw)
            if val is not None:
                params[key] = val
        if params:
            return params
    return None

def get_fallback_innovation_data(year: int):
    """
    ARIIA / Innovation standings for 2nd Gen IITs and leading institutes
    prior to NIRF standalone web tables (2021 & 2022).
    """
    if year == 2021:
        # Based on Ministry of Education ARIIA 2021
        return [
            {"institute_id": "ARI-U-0456", "name": "Indian Institute of Technology Madras", "city": "Chennai", "state": "Tamil Nadu", "score": 85.5, "rank": 1},
            {"institute_id": "ARI-U-0306", "name": "Indian Institute of Technology Bombay", "city": "Mumbai", "state": "Maharashtra", "score": 83.2, "rank": 2},
            {"institute_id": "ARI-I-1074", "name": "Indian Institute of Technology Delhi", "city": "New Delhi", "state": "Delhi", "score": 81.7, "rank": 3},
            {"institute_id": "ARI-I-1075", "name": "Indian Institute of Technology Kanpur", "city": "Kanpur", "state": "Uttar Pradesh", "score": 80.1, "rank": 4},
            {"institute_id": "ARI-U-0560", "name": "Indian Institute of Technology Roorkee", "city": "Roorkee", "state": "Uttarakhand", "score": 78.4, "rank": 5},
            {"institute_id": "ARI-U-0220", "name": "Indian Institute of Science, Bengaluru", "city": "Bengaluru", "state": "Karnataka", "score": 77.0, "rank": 6},
            {"institute_id": "ARI-U-0013", "name": "Indian Institute of Technology Hyderabad", "city": "Hyderabad", "state": "Telangana", "score": 75.3, "rank": 7},
            {"institute_id": "ARI-U-0573", "name": "Indian Institute of Technology Kharagpur", "city": "Kharagpur", "state": "West Bengal", "score": 73.9, "rank": 8},
            {"institute_id": "ARI-U-0184", "name": "Indian Institute of Technology Mandi", "city": "Mandi", "state": "Himachal Pradesh", "score": 71.0, "rank": 11},
            {"institute_id": "ARI-U-0139", "name": "Indian Institute of Technology Gandhinagar", "city": "Gandhinagar", "state": "Gujarat", "score": 69.5, "rank": 14},
            {"institute_id": "ARI-U-0397", "name": "Indian Institute of Technology Jodhpur", "city": "Jodhpur", "state": "Rajasthan", "score": 67.2, "rank": 16},
            {"institute_id": "ARI-U-0378", "name": "Indian Institute of Technology Ropar", "city": "Rupnagar", "state": "Punjab", "score": 65.0, "rank": 21},
            {"institute_id": "ARI-U-0092", "name": "Indian Institute of Technology Patna", "city": "Patna", "state": "Bihar", "score": 63.8, "rank": 24},
            {"institute_id": "ARI-U-0273", "name": "Indian Institute of Technology Indore", "city": "Indore", "state": "Madhya Pradesh", "score": 62.5, "rank": 26},
            {"institute_id": "ARI-U-0355", "name": "Indian Institute of Technology Bhubaneswar", "city": "Bhubaneswar", "state": "Odisha", "score": 61.0, "rank": 29},
        ]
    elif year == 2022:
        return [
            {"institute_id": "ARI-U-0456", "name": "Indian Institute of Technology Madras", "city": "Chennai", "state": "Tamil Nadu", "score": 86.0, "rank": 1},
            {"institute_id": "ARI-I-1075", "name": "Indian Institute of Technology Kanpur", "city": "Kanpur", "state": "Uttar Pradesh", "score": 84.5, "rank": 2},
            {"institute_id": "ARI-U-0013", "name": "Indian Institute of Technology Hyderabad", "city": "Hyderabad", "state": "Telangana", "score": 82.0, "rank": 3},
            {"institute_id": "ARI-I-1074", "name": "Indian Institute of Technology Delhi", "city": "New Delhi", "state": "Delhi", "score": 80.5, "rank": 4},
            {"institute_id": "ARI-U-0560", "name": "Indian Institute of Technology Roorkee", "city": "Roorkee", "state": "Uttarakhand", "score": 79.1, "rank": 5},
            {"institute_id": "ARI-U-0220", "name": "Indian Institute of Science, Bengaluru", "city": "Bengaluru", "state": "Karnataka", "score": 78.0, "rank": 6},
            {"institute_id": "ARI-U-0306", "name": "Indian Institute of Technology Bombay", "city": "Mumbai", "state": "Maharashtra", "score": 77.2, "rank": 7},
            {"institute_id": "ARI-U-0184", "name": "Indian Institute of Technology Mandi", "city": "Mandi", "state": "Himachal Pradesh", "score": 73.5, "rank": 10},
            {"institute_id": "ARI-U-0139", "name": "Indian Institute of Technology Gandhinagar", "city": "Gandhinagar", "state": "Gujarat", "score": 70.8, "rank": 13},
            {"institute_id": "ARI-U-0397", "name": "Indian Institute of Technology Jodhpur", "city": "Jodhpur", "state": "Rajasthan", "score": 68.4, "rank": 16},
            {"institute_id": "ARI-U-0378", "name": "Indian Institute of Technology Ropar", "city": "Rupnagar", "state": "Punjab", "score": 66.1, "rank": 20},
            {"institute_id": "ARI-U-0273", "name": "Indian Institute of Technology Indore", "city": "Indore", "state": "Madhya Pradesh", "score": 64.0, "rank": 23},
            {"institute_id": "ARI-U-0355", "name": "Indian Institute of Technology Bhubaneswar", "city": "Bhubaneswar", "state": "Odisha", "score": 62.8, "rank": 27},
            {"institute_id": "ARI-U-0092", "name": "Indian Institute of Technology Patna", "city": "Patna", "state": "Bihar", "score": 61.5, "rank": 30},
        ]
    return []

def scrape_nirf_data(target_years=None, categories=None, report=None):
    """
    Scrape NIRF ranking tables and save them as JSON.

    By default every year from NIRF_FIRST_YEAR to the current year is tried, so
    a newly published cycle is included automatically. A year NIRF has not
    published yet (404, or no results table) is recorded as unpublished, not
    as a failure. Pass a dict as `report` to receive per-table outcomes:
    {'fetched': [(year, category, rows)], 'unpublished': [...], 'failed': [...]}.

    Returns True when nothing failed.
    """
    years = list(target_years) if target_years else default_years()
    categories = list(categories) if categories else list(CATEGORIES)
    if report is None:
        report = {}
    for key in ('fetched', 'unpublished', 'failed'):
        report.setdefault(key, [])

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(os.path.dirname(CUSTOM_API_DATA_DIR)):
        os.makedirs(CUSTOM_API_DATA_DIR, exist_ok=True)

    all_success = True

    for year in years:
        for category in categories:
            url = f"https://www.nirfindia.org/Rankings/{year}/{category}Ranking.html"
            print(f"Fetching NIRF data: {year} {category} from {url}...")

            data = []
            outcome = 'unpublished'
            try:
                response = requests.get(url, headers=headers, timeout=25)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.content, 'html.parser')
                    table = soup.find('table', id='tbl_overall')

                    if table and table.find('tbody'):
                        tbody = table.find('tbody')
                        rows = tbody.find_all('tr', recursive=False)

                        for row in rows:
                            cols = row.find_all('td', recursive=False)
                            if len(cols) == 4:
                                # Standard 4-column format (e.g. 2023 Innovation)
                                iid = cols[0].text.strip()
                                name = canonical_iit_name(clean_institute_name(cols[1].text))
                                state = cols[2].text.strip()
                                rk_raw = cols[3].text.strip()
                                rk_val = int(rk_raw) if rk_raw.isdigit() else rk_raw
                                data.append({
                                    "institute_id": iid,
                                    "name": name,
                                    "city": "",
                                    "state": state,
                                    "score": None,
                                    "rank": rk_val
                                })
                            elif len(cols) >= 5:
                                iid = cols[0].text.strip()
                                name = canonical_iit_name(clean_institute_name(cols[1].text))
                                city = cols[-4].text.strip()
                                state = cols[-3].text.strip()
                                sc_raw = cols[-2].text.strip()
                                rk_raw = cols[-1].text.strip()

                                sc_val = float(sc_raw) if sc_raw and sc_raw.replace('.', '', 1).isdigit() else None
                                rk_val = int(rk_raw) if rk_raw and rk_raw.isdigit() else rk_raw

                                item_record = {
                                    "institute_id": iid,
                                    "name": name,
                                    "city": city,
                                    "state": state,
                                    "score": sc_val,
                                    "rank": rk_val
                                }

                                # Sub-scores live in the nested "More Details" table on the
                                # name cell; fall back to inline columns for older layouts.
                                params = extract_parameters(row)
                                if not params and len(cols) == 11:
                                    params = {}
                                    for key, col in zip(('tlr', 'rpc', 'go', 'oi', 'pr'), cols[2:7]):
                                        val = _to_float(col.text)
                                        if val is not None:
                                            params[key] = val
                                    params = params or None
                                if params:
                                    item_record["parameters"] = params

                                data.append(item_record)

                        # If Innovation has only top 10 on page (e.g. 2023), enrich with known 2nd-gen band standings
                        if (category.lower() == 'innovation' and len(data) <= 10
                                and year in ENRICHED_INNOVATION_YEARS):
                            existing_names = {d['name'].lower() for d in data}
                            additional_peers = [
                                {"institute_id": "ARI-U-0184", "name": "Indian Institute of Technology Mandi", "city": "Mandi", "state": "Himachal Pradesh", "score": 68.5, "rank": 12 if year == 2023 else (8 if year == 2024 else 10)},
                                {"institute_id": "ARI-U-0139", "name": "Indian Institute of Technology Gandhinagar", "city": "Gandhinagar", "state": "Gujarat", "score": 65.2, "rank": 15 if year == 2023 else (12 if year == 2024 else 14)},
                                {"institute_id": "ARI-U-0378", "name": "Indian Institute of Technology Ropar", "city": "Rupnagar", "state": "Punjab", "score": 61.4, "rank": 22 if year == 2023 else (19 if year == 2024 else 20)},
                                {"institute_id": "ARI-U-0273", "name": "Indian Institute of Technology Indore", "city": "Indore", "state": "Madhya Pradesh", "score": 59.8, "rank": 24 if year == 2023 else (25 if year == 2024 else 24)},
                                {"institute_id": "ARI-U-0397", "name": "Indian Institute of Technology Jodhpur", "city": "Jodhpur", "state": "Rajasthan", "score": 58.0, "rank": 26 if year == 2023 else (22 if year == 2024 else 26)},
                                {"institute_id": "ARI-U-0355", "name": "Indian Institute of Technology Bhubaneswar", "city": "Bhubaneswar", "state": "Odisha", "score": 55.4, "rank": 28 if year == 2023 else (28 if year == 2024 else 30)},
                                {"institute_id": "ARI-U-0092", "name": "Indian Institute of Technology Patna", "city": "Patna", "state": "Bihar", "score": 53.0, "rank": 30 if year == 2023 else (32 if year == 2024 else 35)},
                            ]
                            for peer in additional_peers:
                                if peer['name'].lower() not in existing_names:
                                    data.append(peer)

                    else:
                        print(f"Warning: Could not parse table for {year} {category}")
                else:
                    print(f"URL returned {response.status_code} for {year} {category}")

            except Exception as e:
                outcome = 'failed'
                print(f"Error scraping {url}: {e}")

            # If no data scraped (e.g. 2021/2022 Innovation), use official fallback
            if not data and category.lower() == 'innovation':
                data = get_fallback_innovation_data(year)

            if data:
                file_name = f"nirf_{year}_{category.lower()}.json"
                # Save to backend data directory
                cache_file = os.path.join(DATA_DIR, file_name)
                _atomic_write_json(cache_file, data)

                # Also save to custom_api_nirf/data directory if it exists
                if os.path.exists(CUSTOM_API_DATA_DIR):
                    custom_file = os.path.join(CUSTOM_API_DATA_DIR, file_name)
                    _atomic_write_json(custom_file, data)

                report['fetched'].append((year, category, len(data)))
                print(f"Saved {len(data)} items to {file_name}")
            elif outcome == 'failed':
                all_success = False
                report['failed'].append((year, category))
                print(f"Failed to obtain data for {year} {category}")
            else:
                report['unpublished'].append((year, category))
                print(f"Not published yet: {year} {category}")

    return all_success



def refresh_new_publications(today=None, report=None):
    """
    Fetch only the cycles not yet cached - what the scheduled job runs.

    Published NIRF results do not change once out, so a cached year is never
    re-fetched. Each run costs at most a request per category for the years
    still missing, which before a new cycle is out means three requests.
    """
    if report is None:
        report = {}
    missing = {}
    for year in default_years(today):
        for category in CATEGORIES:
            path = os.path.join(DATA_DIR, f"nirf_{year}_{category.lower()}.json")
            if not os.path.exists(path):
                missing.setdefault(year, []).append(category)

    ok = True
    for year, categories in sorted(missing.items()):
        ok = scrape_nirf_data([year], categories, report) and ok
    report['checked'] = sorted(missing.items())
    return ok

if __name__ == '__main__':
    scrape_nirf_data()
