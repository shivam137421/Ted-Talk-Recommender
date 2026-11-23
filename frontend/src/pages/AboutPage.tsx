import React from "react";
import { BookOpen, Layers, Shield, Cpu, Database } from "lucide-react";

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Header */}
      <div className="space-y-4 border-b border-[#E5E2DC] pb-8">
        <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-[#C8102E]">
          <BookOpen className="w-4 h-4" />
          <span>About the Platform</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#1A1A1A]">
          Intelligent curation for ideas worth spreading
        </h1>
        <p className="text-base text-[#6B6860] leading-relaxed">
          TalkWise is a full-stack personalized recommendation website engineered for educational
          and non-commercial research, exploring how multi-strategy recommender systems can balance
          content relevance, collaborative serendipity, and cold-start discovery.
        </p>
      </div>

      {/* Dataset & Licensing */}
      <section className="space-y-6">
        <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">
          Dataset Documentation & Licensing
        </h2>
        <div className="prose prose-sm text-[#6B6860] space-y-4 text-xs sm:text-sm leading-relaxed">
          <p>
            The recommendation engine and catalog are powered by two historical datasets:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Idiap TED Recommendation Dataset (Zenodo):</strong> Collected by the Idiap Research Institute
              (Sept 2012 snapshot), comprising 129,557 real-user favorite interactions across 1,201 TED talks.
              Licensed under <em>Creative Commons Attribution-NonCommercial-NoDerivs 3.0 Unported (CC-BY-NC-ND 3.0)</em>.
            </li>
            <li>
              <strong>Kaggle TED Talks Corpus:</strong> Comprehensive metadata and transcripts covering 2,550 TED talks
              filmed between 1972 and 2017, licensed for open academic and non-commercial research under CC-BY-NC 4.0.
            </li>
          </ul>

          <div className="p-4 bg-white border border-[#E5E2DC] rounded-xl text-xs space-y-2">
            <p className="font-semibold text-[#1A1A1A]">Historical Snapshot Notice</p>
            <p className="text-[#6B6860]">
              All view counts, durations, and talk records in this system represent a fixed historical snapshot.
              This platform does not mirror or scrape live TED.com analytics. TED® is a registered trademark of
              TED Conferences, LLC, and all talk video rights belong to TED Conferences and respective speakers.
            </p>
          </div>
        </div>
      </section>

      {/* Technical Methodology */}
      <section className="space-y-6">
        <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">
          Recommendation Methodology
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-white border border-[#E5E2DC] rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-[#1A1A1A] font-semibold text-sm">
              <Layers className="w-4 h-4 text-[#C8102E]" />
              <span>Weighted TF-IDF Content Modeling</span>
            </div>
            <p className="text-xs text-[#6B6860] leading-relaxed">
              We extract high-dimensional semantic representations from titles (3x weight), thematic tags (2x),
              speaker background (2x), and speech transcripts (1x), mapping all 2,550 talks into a cosine vector space.
            </p>
          </div>

          <div className="p-6 bg-white border border-[#E5E2DC] rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-[#1A1A1A] font-semibold text-sm">
              <Cpu className="w-4 h-4 text-[#C8102E]" />
              <span>Item-Item Collaborative Filtering</span>
            </div>
            <p className="text-xs text-[#6B6860] leading-relaxed">
              Precomputed top-50 cosine neighbor tables over 129,557 implicit favorites enable instant real-time fold-in
              scoring without requiring model retraining as new favorites arrive.
            </p>
          </div>

          <div className="p-6 bg-white border border-[#E5E2DC] rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-[#1A1A1A] font-semibold text-sm">
              <Shield className="w-4 h-4 text-[#C8102E]" />
              <span>Adaptive History Blending</span>
            </div>
            <p className="text-xs text-[#6B6860] leading-relaxed">
              The hybrid engine dynamically modulates collaborative weight based on interaction volume: 25% for 1-2 favorites,
              50% for 3-4 favorites, and 65% for 5+ favorites, ensuring stability across sparse and rich profiles.
            </p>
          </div>

          <div className="p-6 bg-white border border-[#E5E2DC] rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-[#1A1A1A] font-semibold text-sm">
              <Database className="w-4 h-4 text-[#C8102E]" />
              <span>Dual Cold-Start Routing</span>
            </div>
            <p className="text-xs text-[#6B6860] leading-relaxed">
              New users without favorites are guided by onboarding topic preferences. Talks with zero historical interactions
              are automatically evaluated via content cosine vectors, resolving the cold-start item problem.
            </p>
          </div>
        </div>
      </section>

      {/* Engineering Stack */}
      <section className="space-y-4 pt-6 border-t border-[#E5E2DC]">
        <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">
          Architecture & Technology Stack
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-white border border-[#E5E2DC] rounded-lg">
            <span className="font-semibold text-[#1A1A1A] block">Frontend</span>
            <span className="text-[#6B6860]">React 19, Vite, Tailwind CSS</span>
          </div>
          <div className="p-3 bg-white border border-[#E5E2DC] rounded-lg">
            <span className="font-semibold text-[#1A1A1A] block">API Gateway</span>
            <span className="text-[#6B6860]">Express, TypeScript, Zod</span>
          </div>
          <div className="p-3 bg-white border border-[#E5E2DC] rounded-lg">
            <span className="font-semibold text-[#1A1A1A] block">ML Service</span>
            <span className="text-[#6B6860]">FastAPI, NumPy, SciPy</span>
          </div>
          <div className="p-3 bg-white border border-[#E5E2DC] rounded-lg">
            <span className="font-semibold text-[#1A1A1A] block">Database & Auth</span>
            <span className="text-[#6B6860]">Supabase PostgreSQL & RLS</span>
          </div>
        </div>
      </section>
    </div>
  );
};

