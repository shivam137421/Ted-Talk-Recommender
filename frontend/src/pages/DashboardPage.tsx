import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../services/api.js";
import { Talk } from "../types/talk.js";
import { TalkCard } from "../components/TalkCard.js";
import { SkeletonCard } from "../components/SkeletonCard.js";
import { OnboardingModal } from "../components/OnboardingModal.js";
import { Sparkles, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Talk[]>([]);
  const [trendingTalks, setTrendingTalks] = useState<Talk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setDashboardError(null);
    try {
      // 1. Fetch recommendations
      const recData = await api.getRecommendations({ k: 9 });
      setRecommendations(recData.recommendations || []);
      setIsFallback(recData.is_fallback);
      setFallbackReason(recData.fallback_reason || null);

      // 2. Fetch trending talks
      const trendingData = await api.getTalks({ limit: 6, sort: "views", order: "desc" });
      setTrendingTalks(trendingData.talks || []);

      // 3. Check if user needs onboarding
      if (user) {
        const prefs = await api.getPreferences().catch(() => null);
        if (prefs && !prefs.onboarding_completed && (!prefs.preferred_tags || prefs.preferred_tags.length === 0)) {
          setShowOnboarding(true);
        }
      }
    } catch (err: any) {
      console.error("Dashboard error:", err);
      setDashboardError(err.message || "Failed to load personalized recommendations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleFavoriteToggle = () => {
    // Optionally refresh recommendations when user adds a favorite
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Onboarding Topic Selection Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          loadDashboardData();
        }}
      />

      {/* Error Banner if requests fail */}
      {dashboardError && (
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold">Unable to Load Dashboard Data</p>
              <p className="text-red-700">{dashboardError}</p>
            </div>
          </div>
          <button
            onClick={loadDashboardData}
            className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-black text-white text-xs font-semibold rounded-md shadow-sm shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Fallback Notice Banner if ML service is unreachable */}
      {isFallback && (
        <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Notice: Fallback Feed Active</p>
            <p className="text-amber-700">
              {fallbackReason || "ML recommendation microservice is unreachable. Showing popular talks snapshot."}
            </p>
          </div>
        </div>
      )}

      {/* Primary Section: Personalized Recommendations */}
      <section className="space-y-6">
        <div className="flex items-end justify-between border-b border-[#E5E2DC] pb-4">
          <div>
            <div className="flex items-center space-x-2 text-[#C8102E] text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Tailored For You</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
              Recommended Talks
            </h1>
            <p className="text-xs text-[#6B6860] mt-1">
              Personalized based on your favorite talks, preferred topics, and collaborative viewing signals.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md border border-[#E5E2DC] bg-white hover:border-[#1A1A1A] text-xs font-medium text-[#1A1A1A] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#C8102E]" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={idx} />)
            : recommendations.map((talk) => (
                <TalkCard
                  key={talk.slug}
                  talk={talk}
                  onFavoriteToggle={handleFavoriteToggle}
                />
              ))}
        </div>
      </section>

      {/* Secondary Section: Trending Across TED */}
      <section className="space-y-6 pt-6 border-t border-[#E5E2DC]">
        <div className="flex items-center space-x-2 text-[#6B6860] text-xs font-semibold uppercase tracking-wider mb-1">
          <TrendingUp className="w-4 h-4 text-[#1A1A1A]" />
          <span>Catalog Highlights</span>
        </div>
        <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">
          Trending Across TED
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 3 }).map((_, idx) => <SkeletonCard key={idx} />)
            : trendingTalks.map((talk) => (
                <TalkCard
                  key={talk.slug}
                  talk={talk}
                  onFavoriteToggle={handleFavoriteToggle}
                />
              ))}
        </div>
      </section>
    </div>
  );
};

