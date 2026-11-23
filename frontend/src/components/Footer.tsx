import React from "react";
import { Link } from "react-router-dom";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[#E5E2DC] bg-[#FAF8F5] py-12 mt-20 text-xs text-[#6B6860]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <p className="font-serif text-sm font-semibold text-[#1A1A1A]">
            TalkWise<span className="text-[#C8102E]">.</span>
          </p>
          <p>
            An adaptive hybrid TED Talk recommender developed for non-commercial academic research.
          </p>
          <p className="text-[11px] text-neutral-400">
            Catalog is a static historical snapshot (2,550 talks, 2006–2017). TED® is a trademark of TED Conferences, LLC.
          </p>
        </div>

        <div className="flex items-center space-x-6">
          <Link to="/about" className="hover:text-[#1A1A1A] transition-colors">
            Methodology & License
          </Link>
          <Link to="/browse" className="hover:text-[#1A1A1A] transition-colors">
            Catalog
          </Link>
          <a
            href="https://www.ted.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#C8102E] transition-colors"
          >
            TED.com
          </a>
        </div>
      </div>
    </footer>
  );
};

