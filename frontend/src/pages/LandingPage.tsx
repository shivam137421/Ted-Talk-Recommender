import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search, ShieldCheck, Zap, Layers } from "lucide-react";
import { Talk } from "../types/talk.js";
import { api } from "../services/api.js";
import { TalkCard } from "../components/TalkCard.js";
import { SkeletonCard } from "../components/SkeletonCard.js";

export const LandingPage: React.FC = () => {
  const [featuredTalks, setFeaturedTalks] = useState<Talk[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.getTalks({ limit: 6, sort: "views", order: "desc" })
      .then((data) => setFeaturedTalks(data.talks))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="space-y-24 py-12">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 text-center space-y-8 pt-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-[#E5E2DC] bg-white text-xs text-[#6B6860]">
          <span className="w-2 h-2 rounded-full bg-[#C8102E]" />
          <span>Intelligent Hybrid TED Recommendations</span>
        </div>

        <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-[#1A1A1A] leading-[1.15]">
          Ideas worth spreading, <br className="hidden sm:inline" />
          <span className="italic font-normal">curated for your curiosity.</span>
        </h1>

        <p className="text-base sm:text-lg text-[#6B6860] max-w-2xl mx-auto leading-relaxed">
          TalkWise combines natural language content analysis with collaborative viewing patterns
          to surface talks that resonate with your specific intellectual interests.
        </p>

        {/* Hero Search Bar */}
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic, speaker, or concept (e.g. education, AI, happiness)..."
            className="w-full px-4 py-3.5 pl-11 pr-28 rounded-lg border border-[#E5E2DC] bg-white text-sm focus:outline-none focus:border-[#1A1A1A] shadow-sm transition-all"
          />
          <Search className="w-4 h-4 text-[#6B6860] absolute left-4" />
          <button
            type="submit"
            className="absolute right-2 px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white text-xs font-semibold rounded-md transition-colors"
          >
            Explore
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#6B6860] pt-2">
          <span>Popular topics:</span>
          {["Psychology", "Technology", "Creativity", "Global Issues", "Science"].map((topic) => (
            <Link
              key={topic}
              to={`/browse?tag=${encodeURIComponent(topic.toLowerCase())}`}
              className="px-2.5 py-1 rounded-full border border-[#E5E2DC] bg-white hover:border-[#1A1A1A] transition-colors"
            >
              {topic}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured / Trending Talks Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-end justify-between border-b border-[#E5E2DC] pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#C8102E]">
              From the Archives
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-1">
              Most Influential Talks
            </h2>
          </div>
          <Link
            to="/browse"
            className="inline-flex items-center space-x-1 text-xs font-semibold text-[#1A1A1A] hover:text-[#C8102E] transition-colors"
          >
            <span>View all 2,550 talks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={idx} />)
            : featuredTalks.map((talk) => <TalkCard key={talk.slug} talk={talk} />)}
        </div>
      </section>

      {/* Recommender Architecture Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-white border border-[#E5E2DC] rounded-2xl p-8 sm:p-12">
        <div className="max-w-3xl mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#C8102E]">
            How TalkWise Works
          </span>
          <h2 className="font-serif text-3xl font-bold text-[#1A1A1A] mt-2 mb-4">
            Adaptive, multi-strategy recommendation
          </h2>
          <p className="text-sm text-[#6B6860] leading-relaxed">
            Unlike simple popularity feeds or black-box algorithms, TalkWise adapts its recommendation
            weights transparently based on the depth of your personal viewing history.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] border border-[#E5E2DC] flex items-center justify-center text-[#C8102E]">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#1A1A1A]">
              Content-Based TF-IDF
            </h3>
            <p className="text-xs text-[#6B6860] leading-relaxed">
              Analyzes talk titles, transcripts, and thematic tags using weighted term frequencies
              to pinpoint ideas that share core conceptual DNA.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] border border-[#E5E2DC] flex items-center justify-center text-[#C8102E]">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#1A1A1A]">
              Collaborative Filtering
            </h3>
            <p className="text-xs text-[#6B6860] leading-relaxed">
              Discovers hidden co-occurrence patterns across 129,000+ real TED user favorites,
              surfacing talks frequently appreciated together.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] border border-[#E5E2DC] flex items-center justify-center text-[#C8102E]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#1A1A1A]">
              Cold-Start Resilient
            </h3>
            <p className="text-xs text-[#6B6860] leading-relaxed">
              New to the platform? Select topic interests during onboarding to guide immediate
              recommendations before you favorite your first talk.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

