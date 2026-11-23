import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, ExternalLink, Clock, Eye, Sparkles } from "lucide-react";
import { Talk } from "../types/talk.js";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.js";

interface TalkCardProps {
  talk: Talk;
  onFavoriteToggle?: (slug: string, isFavorited: boolean) => void;
}

const thumbnailMemoryCache = new Map<string, string | null>();
const inFlightThumbnails = new Map<string, Promise<string | null>>();

async function getThumbnail(slug: string): Promise<string | null> {
  if (thumbnailMemoryCache.has(slug)) {
    return thumbnailMemoryCache.get(slug) || null;
  }

  // Check localStorage (persisted across sessions and page navigations)
  try {
    const cached = localStorage.getItem(`talkwise_thumb_${slug}`);
    if (cached !== null) {
      const parsed = cached === "null" ? null : cached;
      thumbnailMemoryCache.set(slug, parsed);
      return parsed;
    }
  } catch {}

  // Deduplicate simultaneous in-flight requests for the same slug
  if (inFlightThumbnails.has(slug)) {
    return inFlightThumbnails.get(slug)!;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`/api/talks/${encodeURIComponent(slug)}/thumbnail`);
      if (!res.ok) throw new Error("Failed to fetch thumbnail");
      const data = await res.json();
      const thumb = data?.thumbnail_url || null;
      thumbnailMemoryCache.set(slug, thumb);
      try {
        localStorage.setItem(`talkwise_thumb_${slug}`, thumb === null ? "null" : thumb);
      } catch {}
      return thumb;
    } catch {
      thumbnailMemoryCache.set(slug, null);
      return null;
    } finally {
      inFlightThumbnails.delete(slug);
    }
  })();

  inFlightThumbnails.set(slug, fetchPromise);
  return fetchPromise;
}

export const TalkCard: React.FC<TalkCardProps> = ({ talk, onFavoriteToggle }) => {
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState<boolean>(Boolean(talk.is_favorited));
  const [isTogglingFav, setIsTogglingFav] = useState<boolean>(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => {
    return talk.thumbnail_url || thumbnailMemoryCache.get(talk.slug) || null;
  });
  const [imgError, setImgError] = useState<boolean>(false);

  useEffect(() => {
    setIsFavorited(Boolean(talk.is_favorited));
  }, [talk.is_favorited]);

  useEffect(() => {
    if (talk.thumbnail_url) {
      setThumbnailUrl(talk.thumbnail_url);
      thumbnailMemoryCache.set(talk.slug, talk.thumbnail_url);
      return;
    }

    let isMounted = true;
    getThumbnail(talk.slug).then((thumb) => {
      if (isMounted) {
        setThumbnailUrl(thumb);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [talk.slug, talk.thumbnail_url]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const formatViews = (views: number) => {
    if (!views) return "0";
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000) return `${Math.round(views / 1_000)}k`;
    return views.toLocaleString();
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (isTogglingFav) return;
    setIsTogglingFav(true);

    const nextState = !isFavorited;
    setIsFavorited(nextState);

    try {
      if (nextState) {
        await api.addFavorite(talk.slug);
      } else {
        await api.removeFavorite(talk.slug);
      }
      onFavoriteToggle?.(talk.slug, nextState);
    } catch (err) {
      setIsFavorited(!nextState); // rollback
    } finally {
      setIsTogglingFav(false);
    }
  };

  const handleWatchOnTedClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    api.logActivity({
      event_type: "ted_click",
      slug: talk.slug,
      metadata: { ted_url: talk.ted_url },
    });
  };

  const primaryTag = talk.tags && talk.tags.length > 0 ? talk.tags[0] : "Idea";

  return (
    <div className="group relative flex flex-col bg-white border border-[#E5E2DC] rounded-lg overflow-hidden hover:border-[#1A1A1A] transition-all duration-200 hover:shadow-sm">
      {/* 16:9 Thumbnail Header with Typographic Fallback */}
      <div className="relative aspect-video w-full bg-[#F5F3EE] overflow-hidden border-b border-[#E5E2DC]">
        {/* Floating Category Tag */}
        <span className="absolute top-3 left-3 z-10 uppercase tracking-wider font-semibold text-[10px] text-[#C8102E] bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded shadow-sm border border-[#E5E2DC]">
          {primaryTag}
        </span>

        {/* Floating Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          className={`absolute top-3 right-3 z-10 p-2 rounded-full shadow-sm transition-all ${
            isFavorited
              ? "bg-[#C8102E] text-white"
              : "bg-white/95 text-[#6B6860] hover:text-[#C8102E] hover:bg-white"
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorited ? "fill-white" : ""}`} />
        </button>

        {/* Floating Duration */}
        <span className="absolute bottom-2 right-2 z-10 flex items-center space-x-1 font-mono text-[10px] bg-black/75 text-white px-2 py-0.5 rounded backdrop-blur-sm">
          <Clock className="w-3 h-3" />
          <span>{formatDuration(talk.duration_seconds)}</span>
        </span>

        {/* Thumbnail Image or Typographic Fallback */}
        <Link to={`/talks/${talk.slug}`} className="block w-full h-full">
          {thumbnailUrl && !imgError ? (
            <img
              src={thumbnailUrl}
              alt={talk.title}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full p-4 flex flex-col justify-center bg-[#F5F3EE]">
              <div className="w-8 h-0.5 bg-[#C8102E] mb-2" />
              <p className="text-xs font-semibold text-[#6B6860] line-clamp-1">
                {talk.speaker}
              </p>
              <h3 className="font-serif text-sm font-bold text-[#1A1A1A] line-clamp-2 leading-snug mt-1">
                {talk.title}
              </h3>
            </div>
          )}
        </Link>
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          <p className="text-xs font-semibold text-[#6B6860] line-clamp-1 mb-1">
            {talk.speaker}
          </p>

          <Link to={`/talks/${talk.slug}`} className="block mb-2">
            <h3 className="font-serif text-sm font-bold text-[#1A1A1A] group-hover:text-[#C8102E] transition-colors line-clamp-2 leading-snug">
              {talk.title}
            </h3>
          </Link>

          <p className="text-xs text-[#6B6860] line-clamp-2 leading-relaxed mb-3">
            {talk.description}
          </p>
        </div>

        <div>
          {/* Recommendation Explanation Badge if present */}
          {talk.explanation && (
            <div className="flex items-start space-x-1.5 p-2 mb-3 bg-[#FAF8F5] border border-[#E5E2DC] rounded text-[11px] text-[#1A1A1A]">
              <Sparkles className="w-3.5 h-3.5 text-[#C8102E] shrink-0 mt-0.5" />
              <span className="line-clamp-2 italic">{talk.explanation}</span>
            </div>
          )}

          {/* Card Footer */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1 text-[#6B6860] text-[11px]" title="Views at dataset snapshot">
              <Eye className="w-3.5 h-3.5" />
              <span>{formatViews(talk.views)} views</span>
            </div>

            <a
              href={talk.ted_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWatchOnTedClick}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-[#1A1A1A] hover:text-[#C8102E] bg-neutral-50 hover:bg-neutral-100 border border-[#E5E2DC] rounded transition-colors"
            >
              <span>Watch on TED</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
