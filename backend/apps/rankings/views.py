import os
import json
from functools import lru_cache
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from .scraper import (
    scrape_nirf_data,
    DATA_DIR,
    TARGET_IITS,
    clean_institute_name,
    canonical_iit_name
)

def get_cache_file(year: int, category: str):
    return os.path.join(DATA_DIR, f"nirf_{year}_{category.lower()}.json")

@lru_cache(maxsize=64)
def load_ranking_data(year: int, category: str):
    cache_file = get_cache_file(year, category)
    if not os.path.exists(cache_file):
        return None
    with open(cache_file, 'r', encoding='utf-8') as f:
        return json.load(f)

class RootRankingWelcomeView(APIView):
    def get(self, request):
        return Response({
            "message": "Welcome to the NIRF Rankings API (Django DRF).",
            "endpoints": [
                "/api/v1/rankings/<year>/<category>/",
                "/api/v1/rankings/<year>/<category>/2nd-gen-iits/",
                "/api/v1/rankings/<year>/<category>/<rank>/",
                "/api/v1/rankings/trends/",
                "/api/v1/scraper/update/",
            ]
        })

class GetRankingsView(APIView):
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
    YEARS = [2021, 2022, 2023, 2024, 2025]
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

            for y in self.YEARS:
                data = load_ranking_data(y, cat_lower) or []
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

            # Convert peers_map to sorted list (Target first, then by 2025 rank ascending)
            peer_list = list(peers_map.values())
            peer_list.sort(key=lambda p: (
                0 if p['is_target'] else 1,
                p['latest_rank'] if isinstance(p['latest_rank'], (int, float)) else 999
            ))
            peer_comparison[cat] = peer_list

        return Response({
            "years": self.YEARS,
            "categories": self.CATEGORIES,
            "target_institute": "Indian Institute of Technology Mandi",
            "iit_mandi_trends": iit_mandi_trends,
            "peer_comparison": peer_comparison,
        })

class TriggerScraperUpdateView(APIView):
    def post(self, request):
        success = scrape_nirf_data()
        if success:
            load_ranking_data.cache_clear()
            return Response({"message": "Ranking data scraped and cache invalidated successfully."})
        return Response(
            {"error": "Failed to scrape some or all data from NIRF website."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
