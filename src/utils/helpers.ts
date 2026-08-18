import { RankingItem, RankingStatus } from "../types";

/**
 * Calculates rank movement and improvement.
 * Note: Lower rank number means BETTER performance (Rank #10 > Rank #20).
 */
export function calculateRankChange(currentRank: number, previousRank?: number): {
  change: number;
  direction: "improved" | "declined" | "unchanged" | "new";
  label: string;
  badgeClass: string;
} {
  if (!previousRank) {
    return {
      change: 0,
      direction: "new",
      label: "New Entry",
      badgeClass: "bg-blue-100 text-blue-800 border border-blue-200"
    };
  }

  // Improvement = previousRank - currentRank (e.g. 31 - 26 = +5)
  const diff = previousRank - currentRank;

  if (diff > 0) {
    return {
      change: diff,
      direction: "improved",
      label: `↑ ${diff} ${diff === 1 ? 'position' : 'positions'}`,
      badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200"
    };
  } else if (diff < 0) {
    const absDiff = Math.abs(diff);
    return {
      change: absDiff,
      direction: "declined",
      label: `↓ ${absDiff} ${absDiff === 1 ? 'position' : 'positions'}`,
      badgeClass: "bg-rose-100 text-rose-800 border border-rose-200"
    };
  } else {
    return {
      change: 0,
      direction: "unchanged",
      label: "→ No Change",
      badgeClass: "bg-gray-100 text-gray-700 border border-gray-200"
    };
  }
}

export function getStatusBadge(status: RankingStatus): {
  bg: string;
  text: string;
  label: string;
} {
  switch (status) {
    case "Published":
      return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-700", label: "Published" };
    case "Verified":
      return { bg: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-700", label: "Verified" };
    case "Under Review":
      return { bg: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-700", label: "Under Review" };
    case "Submitted":
      return { bg: "bg-purple-50 text-purple-700 border-purple-200", text: "text-purple-700", label: "Submitted" };
    case "Draft":
    default:
      return { bg: "bg-gray-100 text-gray-700 border-gray-200", text: "text-gray-700", label: "Draft" };
  }
}

export function exportToCSV(rankings: RankingItem[], filename = "IIT_Mandi_Rankings.csv") {
  if (!rankings || rankings.length === 0) return;

  const headers = [
    "ID",
    "Agency",
    "Ranking Name",
    "Category",
    "Year",
    "Current Rank",
    "Previous Rank",
    "Rank Change",
    "Score",
    "Percentile",
    "Total Institutions",
    "Status",
    "Verified",
    "Source URL",
    "Created Date"
  ];

  const rows = rankings.map(r => {
    const change = calculateRankChange(r.rank, r.previous_rank);
    return [
      `"${r.id}"`,
      `"${r.agency_name}"`,
      `"${r.ranking_name}"`,
      `"${r.category}"`,
      r.year,
      `"#${r.rank}"`,
      r.previous_rank ? `"#${r.previous_rank}"` : "N/A",
      `"${change.label}"`,
      r.score ?? "N/A",
      r.percentile ? `${r.percentile}%` : "N/A",
      r.total_institutions ?? "N/A",
      `"${r.status}"`,
      r.verified ? "Yes" : "No",
      `"${r.source_url || ""}"`,
      `"${r.created_at}"`
    ].join(",");
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function formatDate(isoString?: string): string {
  if (!isoString) return "N/A";
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return isoString;
  }
}
