from fastapi import FastAPI, HTTPException, Query, Path
from fastapi.responses import JSONResponse
import json
import os
from typing import Optional, List, Union

app = FastAPI(
    title="NIRF Rankings API Wrapper",
    description="Custom API wrapper for the NIRF Rankings data.",
    version="1.0.0"
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

from functools import lru_cache

def get_cache_file(year: int, category: str):
    return os.path.join(DATA_DIR, f"nirf_{year}_{category.lower()}.json")

@lru_cache(maxsize=32)
def load_data(year: int, category: str):
    cache_file = get_cache_file(year, category)
    if not os.path.exists(cache_file):
        return None
    with open(cache_file, 'r', encoding='utf-8') as f:
        return json.load(f)

@app.get("/")
def read_root():
    return {"message": "Welcome to the NIRF Rankings API. Visit /docs for API documentation."}

@app.get("/api/v1/rankings/{year}/{category}")
def get_rankings(
    year: int = Path(..., description="The year of the ranking (e.g., 2024, 2025)"),
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
        filtered_data = [item for item in filtered_data if state.lower() in item['state'].lower()]
        
    if city:
        filtered_data = [item for item in filtered_data if city.lower() in item['city'].lower()]
        
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
        
    target_iits = [
        "Indian Institute of Technology Hyderabad",
        "Indian Institute of Technology Indore",
        "Indian Institute of Technology Patna",
        "Indian Institute of Technology Ropar",
        "Indian Institute of Technology Gandhinagar",
        "Indian Institute of Technology Bhubaneswar",
        "Indian Institute of Technology Jodhpur",
        "Indian Institute of Technology Mandi"
    ]
    
    filtered_data = [item for item in data if item['name'] in target_iits]
    
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
        
    # Convert rank param to int if it's purely digits
    # since in JSON exact ranks are stored as ints, rank bands as strings.
    if rank.isdigit():
        parsed_rank = int(rank)
    else:
        parsed_rank = rank

    for item in data:
        if item['rank'] == parsed_rank:
            return item
            
    raise HTTPException(status_code=404, detail=f"Institution with rank {rank} not found.")

@app.post("/api/v1/scraper/update")
def update_cache():
    try:
        import scraper
        success = scraper.scrape_data()
        if success:
            load_data.cache_clear()
            
            # Notify Next.js to drop its cache
            try:
                import requests
                revalidation_secret = os.getenv("REVALIDATION_SECRET")
                if not revalidation_secret:
                    raise RuntimeError("REVALIDATION_SECRET is not configured")
                requests.post(
                    "http://localhost:3000/api/revalidate",
                    json={"tag": "nirf-data", "secret": revalidation_secret},
                    timeout=5,
                ).raise_for_status()
            except Exception as cache_err:
                print(f"Failed to invalidate Next.js cache: {cache_err}")
                
            return {"message": "All data cached successfully. Next.js cache invalidated."}
        else:
            raise HTTPException(status_code=500, detail="Failed to scrape some or all data. Check logs.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
