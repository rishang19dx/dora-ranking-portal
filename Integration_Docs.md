# Project Integration & Caching Documentation

This document outlines the architectural improvements, caching strategies, and features implemented during the integration of the custom Python API (`custom_api_nirf`) into the Next.js frontend repository (`iit-mandi-ranking-portal`).

## 1. Full-Stack Caching Architecture

To ensure high performance and reduce unnecessary disk/network reads for the large NIRF JSON datasets, a **3-Layer Caching Strategy** was implemented across both the backend and frontend.

### Layer 1: Python In-Memory Caching (FastAPI)
By default, the FastAPI backend read JSON files from the disk on every single request.
- **Implementation:** Added Python's built-in `@lru_cache` to `custom_api_nirf/app.py`.
- **Benefit:** Once the JSON is read the first time, it is stored in the server's RAM. Subsequent API calls to the same endpoint are served instantly from memory, bypassing the disk entirely.
- **Cache Invalidation:** The memory cache is automatically cleared (`load_data.cache_clear()`) whenever the web scraper successfully updates the `.json` files.

### Layer 2: Next.js Server-Side Caching (Frontend)
Next.js provides an aggressive server-side caching mechanism for `fetch` requests.
- **Implementation:** Created a centralized API utility at `src/utils/api.ts` containing the `fetchNirfRankings` function.
- **Behavior:** This function makes a `fetch` request to the Python API, but passes `next: { revalidate: 86400, tags: ['nirf-data'] }`. 
- **Benefit:** Next.js caches the Python API's response on the Next.js server for 24 hours. When users visit the site, Next.js serves the cached JSON instantly without even hitting the Python API, allowing the Python server to sleep or scale to zero.

### Layer 3: Webhook-Driven Cache Invalidation
Because Next.js aggressively caches the data for 24 hours, it needs to know immediately when the Python scraper fetches fresh data.
  1. Created a Next.js API Route at `src/app/api/revalidate/route.ts` which exposes an endpoint to trigger `revalidateTag('nirf-data')`.
  2. Modified the `/api/v1/scraper/update` endpoint in `custom_api_nirf/app.py`. Upon a successful scrape, Python uses the `requests` library to send a `POST` request to the Next.js webhook.
- **Benefit:** The moment new data is scraped, Next.js drops its old cache and pulls the fresh data. Users never see stale data, yet you still get all the performance benefits of caching.

## 2. Data Storage (`custom_api_nirf/data/`)

The `custom_api_nirf/data/` directory serves as the local database/storage for the ranking portal's backend.
- **Format:** Data is stored as static JSON files (e.g., `nirf_2024_engineering.json`, `nirf_2025_overall.json`).
- **Generation:** These files are generated and updated by the `scraper.py` script.
- **Access:** The FastAPI backend reads from these files to serve API requests. Thanks to the Layer 1 caching strategy, these files are only read once from disk into memory until the next scraper update.

## 3. Institute Organogram

Created a dynamic organizational chart for the institute to be used in documentation or rendered in the frontend.
- **File:** `Institute_Organogram.md`
- **Technology:** Written using **Mermaid.js** syntax for easy rendering in Markdown and GitHub.
- **Structure:** Maps out the hierarchy from the Board of Governors (BoG) and Director, down through the Deans, Registrar, Academic Chairs, and Faculty Bodies.
- **Customization:** The layout was updated to display Left-to-Right (`graph LR`) for better horizontal readability on wide screens.

## 4. File Tracking Summary

Below is a list of the core files that were created or modified during this integration:

*   **`custom_api_nirf/app.py`** (Modified)
    *   Added `@lru_cache` for in-memory JSON caching.
    *   Added webhook trigger using `requests.post()` on scraper update.
*   **`src/utils/api.ts`** (Created)
    *   Added `fetchNirfRankings()` with Next.js caching tags.
*   **`src/app/api/revalidate/route.ts`** (Created)
    *   Added Next.js App Router webhook to handle `revalidateTag()`.
*   **`Institute_Organogram.md`** (Created)
    *   Added Mermaid flowchart representing the IIT organizational hierarchy.

## 5. Development Time Estimates

*   **Custom API Build Time:** 3 hours
*   **Institute Organogram Build Time:** 1 hour
