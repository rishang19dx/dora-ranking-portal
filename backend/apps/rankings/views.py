import os
import json
from functools import lru_cache
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from .scraper import scrape_nirf_data, DATA_DIR

def get_cache_file(year: int, category: str):
    return os.path.join(DATA_DIR, f"nirf_{year}_{category.lower()}.json")

@lru_cache(maxsize=32)
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

        filtered = [item for item in data if item.get('name') in self.TARGET_IITS]
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
