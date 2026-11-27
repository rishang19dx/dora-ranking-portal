"""
Read access to the cached NIRF result tables.

Two properties matter here, and both used to be wrong:

* No year is assumed. Which years exist is read from the files on disk, so
  when the scheduled refresh saves a newly published NIRF year it becomes
  the "latest" everywhere without a code change.
* The cache is keyed on each file's modification time. Production runs
  several Gunicorn workers, and an in-process cache can only be cleared in
  the worker that handled the request - the others kept serving stale data
  (including a cached "not found" for a year fetched later) until restart.
  Keying on mtime makes every worker, and the scheduler's separate process,
  notice a changed file on its next read.
"""

import json
import os
import re
from functools import lru_cache
from typing import List, Optional

from . import scraper

CATEGORIES = ('Overall', 'Engineering', 'Innovation')


def data_dir() -> str:
    # Read at call time so tests and deployments can relocate it.
    return scraper.DATA_DIR


def get_cache_file(year: int, category: str) -> str:
    return os.path.join(data_dir(), f"nirf_{int(year)}_{category.lower()}.json")


@lru_cache(maxsize=128)
def _read(path: str, mtime_ns: int):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_ranking_data(year: int, category: str):
    """One published table, or None if that year/category is not cached."""
    path = get_cache_file(year, category)
    try:
        mtime = os.stat(path).st_mtime_ns
    except FileNotFoundError:
        return None
    return _read(path, mtime)


# Kept for callers that clear the cache explicitly; with mtime keying it is
# no longer needed for correctness.
load_ranking_data.cache_clear = _read.cache_clear


def available_years(category: str) -> List[int]:
    """Every year cached for a category, oldest first."""
    pattern = re.compile(rf'nirf_(\d{{4}})_{re.escape(category.lower())}\.json$')
    try:
        names = os.listdir(data_dir())
    except FileNotFoundError:
        return []
    return sorted(int(m.group(1)) for m in (pattern.match(n) for n in names) if m)


def latest_year(category: str = 'Engineering') -> Optional[int]:
    years = available_years(category)
    return years[-1] if years else None


def trend_window(categories, size: int = 5) -> List[int]:
    """The most recent `size` years for which any of `categories` has data."""
    years = sorted({y for c in categories for y in available_years(c)})
    return years[-size:]
