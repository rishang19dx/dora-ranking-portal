const API_BASE_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://127.0.0.1:8000';

export interface NirfRankingItem {
  id?: string;
  name: string;
  state: string;
  city: string;
  rank: number | string;
  score?: number | string;
  [key: string]: any;
}

export interface NirfApiResponse {
  count: number;
  data: NirfRankingItem[];
}

export async function fetchNirfRankings(
  year: number,
  category: string,
  params?: { limit?: number; state?: string; city?: string }
): Promise<NirfApiResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.state) searchParams.append('state', params.state);
  if (params?.city) searchParams.append('city', params.city);

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/v1/rankings/${year}/${category}${queryString ? `?${queryString}` : ''}`;

  try {
    const res = await fetch(url, {
      // Revalidate every 24 hours (86400 seconds)
      next: {
        revalidate: 86400,
        tags: ['nirf-data'],
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch NIRF rankings: ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching NIRF data:', error);
    return { count: 0, data: [] };
  }
}
