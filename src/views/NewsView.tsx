import React, { useState } from "react";
import { Newspaper, Calendar, ExternalLink, ArrowRight, X } from "lucide-react";
import { NewsUpdate } from "../types";
import { formatDate } from "../utils/helpers";

interface NewsViewProps {
  news: NewsUpdate[];
}

export const NewsView: React.FC<NewsViewProps> = ({ news }) => {
  const [selectedArticle, setSelectedArticle] = useState<NewsUpdate | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-[#F58220]" />
          News & Ranking Updates
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Official announcements, press releases, and ranking milestones from Indian Institute of Technology Mandi.
        </p>
      </div>

      {/* News Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {news.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedArticle(item)}
            className="bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition overflow-hidden cursor-pointer flex flex-col justify-between group"
          >
            {item.image_url && (
              <div className="h-44 overflow-hidden relative">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-3 left-3 bg-[#003366]/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded shadow">
                  {formatDate(item.date)}
                </span>
              </div>
            )}

            <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base group-hover:text-[#003366] transition leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-600 line-clamp-3 mt-2 leading-relaxed">
                  {item.short_description}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100 text-xs text-[#003366] font-bold flex items-center gap-1 group-hover:text-[#F58220] transition">
                <span>Read Full Press Release</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full Article Modal Reader */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto overflow-hidden animate-in fade-in zoom-in duration-200">
            {selectedArticle.image_url && (
              <div className="h-56 relative">
                <img
                  src={selectedArticle.image_url}
                  alt={selectedArticle.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="w-4 h-4 text-[#F58220]" />
                <span>Published on {formatDate(selectedArticle.date)}</span>
                <span>•</span>
                <span className="text-[#003366] font-semibold">IIT Mandi Media Cell</span>
              </div>

              <h2 className="text-xl font-bold text-[#003366] font-serif leading-tight">
                {selectedArticle.title}
              </h2>

              <p className="text-xs sm:text-sm font-semibold text-gray-700 bg-blue-50/70 p-3.5 rounded-xl border border-blue-100">
                {selectedArticle.short_description}
              </p>

              <div className="text-xs sm:text-sm text-gray-800 leading-relaxed space-y-3 pt-2">
                {selectedArticle.full_content}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="bg-[#003366] hover:bg-blue-900 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  Close Release
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
