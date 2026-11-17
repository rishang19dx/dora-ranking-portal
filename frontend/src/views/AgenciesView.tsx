import React from "react";
import { Building2, ExternalLink, Globe, Award, ShieldCheck } from "lucide-react";
import { RankingAgency, RankingItem } from "../types";

const FEATURED_FRAMEWORKS = [
  {
    name: "National Institutional Ranking Framework (NIRF)",
    description: "India’s national framework evaluates higher-education institutions across teaching, learning and resources, research, graduation outcomes, outreach and perception.",
    measures: ["Teaching, Learning & Resources", "Research & Professional Practice", "Graduation Outcomes", "Outreach, Inclusivity & Perception"],
    href: "https://www.nirfindia.org/",
  },
  {
    name: "Times Higher Education (THE)",
    description: "THE evaluates universities using 13 performance indicators across teaching, research, knowledge transfer, and international outlook.",
    measures: ["Teaching", "Research", "Knowledge Transfer", "International Outlook"],
    href: "https://www.timeshighereducation.com/",
  },
  {
    name: "QS World University Rankings",
    description: "QS assesses academic and employer reputation, teaching capacity, research impact, and internationalisation, with newer measures for research networks, employment outcomes, and sustainability.",
    measures: ["Academic & employer reputation", "Teaching & research impact", "International outlook", "Sustainability"],
    href: "https://www.topuniversities.com/world-university-rankings",
  },
  {
    name: "India Today–MDRA Rankings",
    description: "India Today’s college rankings recognise IIT Mandi across technical-university and engineering-college categories.",
    measures: ["Best Technical University", "Engineering colleges", "Emerging government colleges", "Most improved colleges"],
    href: "https://bestcolleges.indiatoday.in/",
  },
];

interface AgenciesViewProps {
  agencies?: RankingAgency[];
  rankings?: RankingItem[];
  onSelectRanking?: (ranking: RankingItem) => void;
  onSelectAgency?: (agency: RankingAgency) => void;
}

export const AgenciesView: React.FC<AgenciesViewProps> = ({
  agencies = [],
  rankings = [],
  onSelectRanking = () => {},
  onSelectAgency,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#F58220]" />
          Ranking Agencies & Frameworks
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          National and international agencies evaluating Indian Institute of Technology Mandi across engineering, innovation, research, and global academic reputation.
        </p>
      </div>

      {/* Grid of Agencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agencies.map((agency) => {
          // Find verified rankings for this agency
          const agencyRankings = rankings
            .filter((r) => r.agency_id === agency.id || r.agency_name.toLowerCase().includes(agency.short_name.toLowerCase()))
            .sort((a, b) => b.year - a.year);

          return (
            <div
              key={agency.id}
              className="bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition p-6 flex flex-col justify-between"
            >
              <div>
                {/* Agency Title & Logo */}
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
                  <div>
                    <span className="bg-blue-50 text-[#003366] text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                      {agency.short_name}
                    </span>
                    <h2 className="text-lg font-bold text-gray-900 mt-1 leading-snug">
                      {agency.name}
                    </h2>
                  </div>

                  <div className="w-12 h-12 bg-slate-50 rounded-xl border border-gray-200 p-2 shrink-0 flex items-center justify-center font-bold text-[#003366] text-xs">
                    {agency.short_name.slice(0, 4)}
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed mb-4">
                  {agency.description}
                </p>

                {/* IIT Mandi's Ranks in this agency */}
                <div className="space-y-2 mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                    IIT Mandi Verified Rankings ({agencyRankings.length})
                  </span>

                  {agencyRankings.length > 0 ? (
                    <div className="space-y-2">
                      {agencyRankings.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          onClick={() => onSelectRanking(r)}
                          className="flex items-center justify-between bg-slate-50 hover:bg-blue-50/70 p-2.5 rounded-lg border border-slate-200/80 cursor-pointer transition text-xs"
                        >
                          <div>
                            <span className="font-bold text-gray-900">{r.category} ({r.year})</span>
                            <span className="text-[11px] text-gray-500 block">{r.ranking_name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-[#003366]">#{r.rank}</span>
                            <span className="text-[10px] text-emerald-700 block font-medium">Verified</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic bg-slate-50 p-3 rounded text-center">
                      No active verified rankings logged for this agency yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Agency External Link */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <a
                  href={agency.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1 hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Official Agency Website</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Active Framework
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Published framework context remains useful even before agency records are API-managed. */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5 text-[#F58220]" />
          <h2 className="text-lg font-bold text-[#003366]">Featured Ranking Frameworks</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {FEATURED_FRAMEWORKS.map((framework) => (
            <article key={framework.name} className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5 flex flex-col">
              <h3 className="font-bold text-gray-900">{framework.name}</h3>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">{framework.description}</p>
              <ul className="mt-4 space-y-1.5 text-xs text-gray-700">
                {framework.measures.map((measure) => (
                  <li key={measure} className="flex gap-2"><span className="text-[#F58220]">•</span>{measure}</li>
                ))}
              </ul>
              <a
                href={framework.href}
                target="_blank"
                rel="noreferrer"
                className="mt-5 text-blue-700 hover:text-blue-900 font-semibold text-xs inline-flex items-center gap-1 hover:underline"
              >
                Official website <ExternalLink className="w-3 h-3" />
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
