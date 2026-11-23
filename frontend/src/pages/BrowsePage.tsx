import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, ChevronLeft, ChevronRight, X, AlertCircle } from "lucide-react";
import { Talk } from "../types/talk.js";
import { api } from "../services/api.js";
import { TalkCard } from "../components/TalkCard.js";
import { SkeletonCard } from "../components/SkeletonCard.js";

export const BrowsePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [talks, setTalks] = useState<Talk[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 18,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const query = searchParams.get("q") || "";
  const selectedTag = searchParams.get("tag") || "";
  const sort = searchParams.get("sort") || "views";
  const page = parseInt(searchParams.get("page") || "1", 10);

  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    api.getPopularTags().then(setTags).catch(() => {});
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError(null);
    api.getTalks({
      page,
      limit: 18,
      q: query || undefined,
      tag: selectedTag || undefined,
      sort,
      order: "desc",
    })
      .then((data) => {
        if (!isCurrent) return;
        setTalks(data.talks || []);
        setPagination(data.pagination || { total: 0, page: 1, limit: 18, totalPages: 1 });
      })
      .catch((err: any) => {
        if (!isCurrent) return;
        setError(err.message || "Failed to load talks catalog.");
        setTalks([]);
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [page, query, selectedTag, sort]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      newParams.set("q", searchInput.trim());
    } else {
      newParams.delete("q");
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handleTagClick = (tag: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (selectedTag === tag) {
      newParams.delete("tag");
    } else {
      newParams.set("tag", tag);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handleSortChange = (newSort: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("sort", newSort);
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", newPage.toString());
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="border-b border-[#E5E2DC] pb-6">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A]">
          Explore the Catalog
        </h1>
        <p className="text-xs sm:text-sm text-[#6B6860] mt-1">
          Search and discover across all 2,550 recorded TED Talks.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, speaker, or description..."
              className="w-full px-4 py-2.5 pl-10 pr-10 rounded-md border border-[#E5E2DC] bg-white text-xs sm:text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
            <Search className="w-4 h-4 text-[#6B6860] absolute left-3 top-3" />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  const p = new URLSearchParams(searchParams);
                  p.delete("q");
                  p.set("page", "1");
                  setSearchParams(p);
                }}
                className="absolute right-3 top-3 text-[#6B6860] hover:text-[#1A1A1A]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Sort Selector */}
          <div className="flex items-center space-x-2 text-xs text-[#6B6860]">
            <Filter className="w-3.5 h-3.5" />
            <span>Sort by:</span>
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 rounded-md border border-[#E5E2DC] bg-white text-xs font-medium text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
            >
              <option value="views">Most Viewed</option>
              <option value="published_at">Recently Published</option>
              <option value="duration_seconds">Duration</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Tag Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none text-xs">
          <button
            onClick={() => handleTagClick("")}
            className={`px-3 py-1.5 rounded-full border transition-all shrink-0 ${
              !selectedTag
                ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                : "bg-white text-[#6B6860] border-[#E5E2DC] hover:border-[#1A1A1A]"
            }`}
          >
            All Topics
          </button>
          {tags.map((tag) => {
            const isSelected = selectedTag === tag;
            return (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`px-3 py-1.5 rounded-full border capitalize transition-all shrink-0 ${
                  isSelected
                    ? "bg-[#C8102E] text-white border-[#C8102E]"
                    : "bg-white text-[#6B6860] border-[#E5E2DC] hover:border-[#1A1A1A]"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Talks Grid */}
      <div className="space-y-8">
        <div className="flex items-center justify-between text-xs text-[#6B6860]">
          <span>
            Showing {talks.length} of {pagination.total.toLocaleString()} talks
          </span>
          {pagination.totalPages > 1 && (
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
          )}
        </div>

        {error ? (
          <div className="py-16 text-center space-y-4 bg-red-50/60 border border-red-200 rounded-xl p-6">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="font-serif text-lg font-semibold text-red-900">
              Unable to Load Talks Catalog
            </p>
            <p className="text-xs text-red-700 max-w-md mx-auto">
              {error}
            </p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                api.getTalks({ page, limit: 18, q: query || undefined, tag: selectedTag || undefined, sort, order: "desc" })
                  .then((data) => {
                    setTalks(data.talks || []);
                    setPagination(data.pagination);
                  })
                  .catch((err: any) => setError(err.message || "Failed to load talks."))
                  .finally(() => setLoading(false));
              }}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white text-xs font-semibold rounded-md shadow-sm"
            >
              Retry Loading Catalog
            </button>
          </div>
        ) : talks.length === 0 && !loading ? (
          <div className="py-20 text-center space-y-3 bg-white border border-[#E5E2DC] rounded-xl">
            <p className="font-serif text-xl font-semibold text-[#1A1A1A]">
              No talks matched your criteria
            </p>
            <p className="text-xs text-[#6B6860]">
              Try adjusting your search query or selecting a different topic tag.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading
              ? Array.from({ length: 9 }).map((_, idx) => <SkeletonCard key={idx} />)
              : talks.map((talk) => <TalkCard key={talk.slug} talk={talk} />)}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center space-x-3 pt-6 border-t border-[#E5E2DC]">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrevPage}
              className="flex items-center space-x-1 px-3 py-2 rounded-md border border-[#E5E2DC] bg-white text-xs font-medium text-[#1A1A1A] hover:border-[#1A1A1A] disabled:opacity-40 disabled:hover:border-[#E5E2DC]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-medium text-[#1A1A1A] px-2">
              {pagination.page} / {pagination.totalPages}
            </span>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
              className="flex items-center space-x-1 px-3 py-2 rounded-md border border-[#E5E2DC] bg-white text-xs font-medium text-[#1A1A1A] hover:border-[#1A1A1A] disabled:opacity-40 disabled:hover:border-[#E5E2DC]"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

