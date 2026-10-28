from fastapi import FastAPI, HTTPException, Query, Path
from fastapi.responses import JSONResponse
import json
import os
from typing import Optional, List, Union
from functools import lru_cache

app = FastAPI(
    title="NIRF Rankings API Wrapper",
    description="Custom API wrapper for the NIRF Rankings data.",
    version="1.1.0"
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

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

def canonical_iit_name(name: str) -> str:
    lower = name.lower()
    for canonical in TARGET_IITS:
        keyword = canonical.replace("Indian Institute of Technology ", "").lower()
        if keyword in lower and ("technology" in lower or "iit" in lower):
            return canonical
    return name

def get_cache_file(year: int, category: str):
    return os.path.join(DATA_DIR, f"nirf_{year}_{category.lower()}.json")

@lru_cache(maxsize=64)
def load_data(year: int, category: str):
    cache_file = get_cache_file(year, category)
    if not os.path.exists(cache_file):
        return None
    with open(cache_file, 'r', encoding='utf-8') as f:
        return json.load(f)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to the NIRF Rankings API. Visit /docs for API documentation.",
        "endpoints": [
            "/api/v1/rankings/trends",
            "/api/v1/rankings/{year}/{category}",
            "/api/v1/rankings/{year}/{category}/2nd-gen-iits",
            "/api/v1/rankings/{year}/{category}/{rank}",
            "/api/v1/scraper/update",
        ]
    }

@app.get("/api/v1/rankings/trends")
def get_trends(category: Optional[str] = Query(None, description="Category filter (e.g., Engineering, Innovation, Overall)")):
    """Returns 5-year longitudinal trend data for 2nd Gen IITs."""
    years = [2021, 2022, 2023, 2024, 2025]
    all_categories = ['Engineering', 'Innovation', 'Overall']
    active_cats = [category.capitalize()] if category and category.capitalize() in all_categories else all_categories

    iit_mandi_trends = {}
    peer_comparison = {}

    for cat in active_cats:
        cat_lower = cat.lower()
        mandi_yearly = []

        peers_map = {
            t_name: {
                "institute": t_name,
                "short_name": SHORT_NAMES.get(t_name, t_name),
                "is_target": (t_name == "Indian Institute of Technology Mandi"),
                "ranks": {},
                "scores": {},
                "latest_rank": None,
                "latest_score": None,
            }
            for t_name in TARGET_IITS
        }

        for y in years:
            data = load_data(y, cat_lower) or []
            for item in data:
                c_name = canonical_iit_name(item.get('name', ''))
                if c_name in peers_map:
                    rk = item.get('rank')
                    sc = item.get('score')
                    peers_map[c_name]["ranks"][str(y)] = rk
                    peers_map[c_name]["scores"][str(y)] = sc
                    if y == 2025:
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

        peer_list = list(peers_map.values())
        peer_list.sort(key=lambda p: (
            0 if p['is_target'] else 1,
            p['latest_rank'] if isinstance(p['latest_rank'], (int, float)) else 999
        ))
        peer_comparison[cat] = peer_list

    return {
        "years": years,
        "categories": all_categories,
        "target_institute": "Indian Institute of Technology Mandi",
        "iit_mandi_trends": iit_mandi_trends,
        "peer_comparison": peer_comparison,
    }

@app.get("/api/v1/rankings/{year}/{category}")
def get_rankings(
    year: int = Path(..., description="The year of the ranking (e.g., 2021-2025)"),
    category: str = Path(..., description="The category (e.g., overall, engineering, innovation)"),
    limit: Optional[int] = Query(None, description="Limit the number of results returned"),
    state: Optional[str] = Query(None, description="Filter by state (case-insensitive)"),
    city: Optional[str] = Query(None, description="Filter by city (case-insensitive)")
):
    data = load_data(year, category)
    if data is None:
        raise HTTPException(status_code=404, detail="Data not found for the specified year and category.")
        
    filtered_data = data
    if state:
        filtered_data = [item for item in filtered_data if state.lower() in item.get('state', '').lower()]
    if city:
        filtered_data = [item for item in filtered_data if city.lower() in item.get('city', '').lower()]
    if limit:
        filtered_data = filtered_data[:limit]
        
    return {
        "count": len(filtered_data),
        "data": filtered_data
    }

@app.get("/api/v1/rankings/{year}/{category}/2nd-gen-iits")
def get_second_gen_iits(
    year: int = Path(..., description="The year of the ranking"),
    category: str = Path(..., description="The category")
):
    """Get rankings for the 2nd generation IITs only."""
    data = load_data(year, category)
    if data is None:
        raise HTTPException(status_code=404, detail="Data not found for the specified year and category.")
        
    filtered_data = []
    for item in data:
        c_name = canonical_iit_name(item.get('name', ''))
        if c_name in TARGET_IITS:
            item_copy = dict(item)
            item_copy['canonical_name'] = c_name
            filtered_data.append(item_copy)
    
    return {
        "count": len(filtered_data),
        "data": filtered_data
    }

@app.get("/api/v1/rankings/{year}/{category}/{rank}")
def get_ranking_by_rank(
    year: int = Path(..., description="The year of the ranking"),
    category: str = Path(..., description="The category"),
    rank: str = Path(..., description="The rank (can be int like '1' or string like '101-150')")
):
    data = load_data(year, category)
    if data is None:
        raise HTTPException(status_code=404, detail="Data not found for the specified year and category.")
        
    if rank.isdigit():
        parsed_rank = int(rank)
    else:
        parsed_rank = rank

    for item in data:
        if item.get('rank') == parsed_rank:
            return item
            
    raise HTTPException(status_code=404, detail=f"Institution with rank {rank} not found.")

@app.post("/api/v1/scraper/update")
def update_cache():
    try:
        from apps.rankings import scraper
        success = scraper.scrape_nirf_data()
        if success:
            load_data.cache_clear()
            
            # Notify Next.js / frontend to drop its cache if configured
            try:
                import requests
                requests.post("http://localhost:3000/api/revalidate", json={"tag": "nirf-data"}, timeout=5)
            except Exception as cache_err:
                print(f"Cache webhook notice: {cache_err}")
                
            return {"message": "All data cached successfully. Next.js cache invalidated."}
        else:
            raise HTTPException(status_code=500, detail="Failed to scrape some or all data. Check logs.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
