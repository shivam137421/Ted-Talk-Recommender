import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ExternalLink, Heart, Clock, Eye, Calendar, Sparkles, ChevronLeft, Mic } from "lucide-react";
import { Talk } from "../types/talk.js";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.js";
import { TalkCard } from "../components/TalkCard.js";

export const TalkDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [talk, setTalk] = useState<Talk | null>(null);
  const [similarTalks, setSimilarTalks] = useState<Talk[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFav, setIsTogglingFav] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    // Fetch thumbnail
    fetch(`/api/talks/${encodeURIComponent(slug)}/thumbnail`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.thumbnail_url) setThumbnailUrl(data.thumbnail_url);
      })
      .catch(() => {});

    // Fetch talk details
    api.getTalkBySlug(slug)
      .then((data) => {
        setTalk(data);
        setIsFavorited(Boolean(data.is_favorited));

        // Log view event
        if (user) {
          api.logActivity({
            event_type: "view",
            slug: data.slug,
            metadata: { title: data.title },
          });
        }
      })
      .catch(() => setTalk(null))
      .finally(() => setLoading(false));

    // Fetch similar talks directly from hydrated API
    api.getSimilarTalks(slug, 4)
      .then((sims) => {
        if (Array.isArray(sims) && sims.length > 0) {
          setSimilarTalks(sims.slice(0, 3));
        }
      })
      .catch(() => {});
  }, [slug, user]);

  const handleFavoriteToggle = async () => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    if (!talk || isTogglingFav) return;
    setIsTogglingFav(true);

    const nextState = !isFavorited;
    setIsFavorited(nextState);

    try {
      if (nextState) {
        await api.addFavorite(talk.slug);
      } else {
        await api.removeFavorite(talk.slug);
      }
    } catch {
      setIsFavorited(!nextState);
    } finally {
      setIsTogglingFav(false);
    }
  };

  const handleWatchOnTed = () => {
    if (talk) {
      api.logActivity({
        event_type: "ted_click",
        slug: talk.slug,
        metadata: { ted_url: talk.ted_url },
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[#C8102E] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-[#6B6860] mt-3">Loading talk details...</p>
      </div>
    );
  }

  if (!talk) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-serif text-2xl font-bold text-[#1A1A1A]">Talk Not Found</h1>
        <p className="text-xs text-[#6B6860]">
          The requested TED Talk could not be found in our historical snapshot catalog.
        </p>
        <Link
          to="/browse"
          className="inline-flex items-center space-x-1 px-4 py-2 bg-[#1A1A1A] text-white text-xs font-semibold rounded-md"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Back to Catalog</span>
        </Link>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/browse"
          className="inline-flex items-center space-x-1 text-xs text-[#6B6860] hover:text-[#1A1A1A] transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Back to Browse</span>
        </Link>
      </div>

      {/* Main Talk Header & Hero Block */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-6 sm:p-10 space-y-8 shadow-sm">
        <div className="space-y-4">
          {/* Tags bar */}
          <div className="flex flex-wrap gap-2">
            {talk.tags.map((tag) => (
              <Link
                key={tag}
                to={`/browse?tag=${encodeURIComponent(tag.toLowerCase())}`}
                className="px-2.5 py-0.5 rounded-full border border-[#E5E2DC] bg-[#FAF8F5] hover:border-[#1A1A1A] text-[11px] font-medium text-[#6B6860] capitalize transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>

          {/* Red line indicator */}
          <div className="w-12 h-1 bg-[#C8102E]" />

          {/* Talk Title */}
          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#1A1A1A] leading-tight">
            {talk.title}
          </h1>

          {/* Speaker details */}
          <div className="flex items-center space-x-3 text-sm text-[#1A1A1A] pt-2">
            <div className="w-9 h-9 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xs">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-base">{talk.speaker}</p>
              {talk.speaker_occupation && (
                <p className="text-xs text-[#6B6860]">{talk.speaker_occupation}</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar (Watch on TED + Favorite) */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[#E5E2DC]">
          <a
            href={talk.ted_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWatchOnTed}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-[#C8102E] hover:bg-[#A00C24] text-white text-sm font-semibold rounded-lg shadow-sm transition-all hover:scale-[1.01]"
          >
            <span>Watch on TED</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={handleFavoriteToggle}
            className={`inline-flex items-center space-x-2 px-5 py-3 rounded-lg border text-sm font-medium transition-all ${
              isFavorited
                ? "bg-[#FAF8F5] text-[#C8102E] border-[#C8102E]"
                : "bg-white text-[#1A1A1A] border-[#E5E2DC] hover:border-[#1A1A1A]"
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorited ? "fill-[#C8102E] text-[#C8102E]" : ""}`} />
            <span>{isFavorited ? "Favorited" : "Add to Favorites"}</span>
          </button>
        </div>

        {/* Official Video Thumbnail Banner */}
        {thumbnailUrl && (
          <div className="relative aspect-video rounded-xl overflow-hidden border border-[#E5E2DC] bg-[#1A1A1A] shadow-inner group">
            <img
              src={thumbnailUrl}
              alt={talk.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end justify-between p-6">
              <span className="text-xs text-white/90 font-medium">TED Official Recording</span>
              <a
                href={talk.ted_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWatchOnTed}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#C8102E] hover:bg-[#A00C24] text-white text-xs font-semibold rounded-md shadow transition-colors"
              >
                <span>Watch full talk on TED.com</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2 pt-4 border-t border-[#E5E2DC]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B6860]">
            Overview
          </h2>
          <p className="text-sm sm:text-base text-[#1A1A1A] leading-relaxed">
            {talk.description}
          </p>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-[#E5E2DC] text-xs">
          <div>
            <span className="text-[#6B6860] block mb-1">Duration</span>
            <div className="flex items-center space-x-1 font-medium text-[#1A1A1A]">
              <Clock className="w-3.5 h-3.5 text-[#C8102E]" />
              <span>{formatDuration(talk.duration_seconds)}</span>
            </div>
          </div>

          <div>
            <span className="text-[#6B6860] block mb-1">Views at Snapshot</span>
            <div className="flex items-center space-x-1 font-medium text-[#1A1A1A]">
              <Eye className="w-3.5 h-3.5 text-[#C8102E]" />
              <span>{talk.views.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <span className="text-[#6B6860] block mb-1">Event</span>
            <div className="flex items-center space-x-1 font-medium text-[#1A1A1A]">
              <Sparkles className="w-3.5 h-3.5 text-[#C8102E]" />
              <span className="truncate">{talk.event || "TED Conference"}</span>
            </div>
          </div>

          <div>
            <span className="text-[#6B6860] block mb-1">Published</span>
            <div className="flex items-center space-x-1 font-medium text-[#1A1A1A]">
              <Calendar className="w-3.5 h-3.5 text-[#C8102E]" />
              <span>
                {talk.published_at ? new Date(talk.published_at).toLocaleDateString() : "Historical"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Talks Section */}
      {similarTalks.length > 0 && (
        <section className="space-y-6">
          <div className="border-b border-[#E5E2DC] pb-4">
            <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">
              Related Talks
            </h2>
            <p className="text-xs text-[#6B6860] mt-1">
              Talks sharing thematic and conceptual overlap with this presentation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {similarTalks.map((simTalk) => (
              <TalkCard key={simTalk.slug} talk={simTalk} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

