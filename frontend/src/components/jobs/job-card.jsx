import React from 'react';
import { MapPin, Banknote, Building2, ExternalLink } from 'lucide-react';

// Highlight matched keywords
const HighlightText = ({ text, query }) => {
  if (!query || typeof text !== 'string') return <>{text}</>;
  
  // Split on query, case-insensitive
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <span key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-slate-900 dark:text-yellow-100 px-0.5 rounded-sm font-semibold">{part}</span> 
          : part
      )}
    </>
  );
};

export default function JobCard({ job, onClick, searchQuery = '' }) {
  const { title, company, location, salary, summary, apply_url, url } = job;

  // Fallback to URL if apply_url isn't explicitly provided
  const applicationLink = apply_url || url;

  return (
    <div 
      onClick={onClick}
      className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-brand-500/30 transition-all duration-300 flex flex-col h-full relative overflow-hidden focus-within:ring-2 focus-within:ring-brand-500"
    >
      
      {/* Background Glow on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/60 to-brand-100/40 dark:from-brand-900/10 dark:to-brand-800/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header: Title & Company */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1">
            <HighlightText text={title} query={searchQuery} />
          </h3>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium text-sm">
            <Building2 className="w-4 h-4" />
            <HighlightText text={company} query={searchQuery} />
          </div>
        </div>

        {/* Metadata: Location & Salary */}
        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          {location && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md border border-slate-100 dark:border-slate-800">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[150px]"><HighlightText text={location} query={searchQuery} /></span>
            </div>
          )}
          {salary && (
            <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-md border border-green-100 dark:border-green-500/20 font-medium">
              <Banknote className="w-3.5 h-3.5" />
              {salary}
            </div>
          )}
        </div>

        {/* Description: 2 lines max */}
        <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 leading-relaxed mb-6 flex-grow">
          <HighlightText text={summary || 'No description provided.'} query={searchQuery} />
        </p>

        {/* Action Button */}
        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/50" onClick={(e) => e.stopPropagation()}>
          <a
            href={applicationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-600 dark:hover:bg-brand-600 text-brand-700 dark:text-brand-300 hover:text-white font-bold rounded-xl transition-all duration-300 outline-none"
          >
            Apply Now
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
