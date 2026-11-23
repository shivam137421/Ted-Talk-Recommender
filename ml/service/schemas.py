"""Data schemas for TalkWise ML microservice."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class RecommendationRequest:
    favorite_slugs: List[str] = field(default_factory=list)
    preferred_tags: List[str] = field(default_factory=list)
    k: int = 10
    exclude_slugs: List[str] = field(default_factory=list)
    include_favorites: bool = False

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RecommendationRequest":
        if not isinstance(data, dict):
            raise ValueError("Payload must be a JSON object")
        
        favs = data.get("favorite_slugs", [])
        if not isinstance(favs, list):
            favs = []
        tags = data.get("preferred_tags", [])
        if not isinstance(tags, list):
            tags = []
        k = data.get("k", 10)
        try:
            k = int(k)
        except (ValueError, TypeError):
            k = 10
        k = max(1, min(k, 100))

        exclude = data.get("exclude_slugs", [])
        if not isinstance(exclude, list):
            exclude = []
        
        inc_favs = bool(data.get("include_favorites", False))

        return cls(
            favorite_slugs=[str(s).strip() for s in favs if s],
            preferred_tags=[str(t).strip().lower() for t in tags if t],
            k=k,
            exclude_slugs=[str(s).strip() for s in exclude if s],
            include_favorites=inc_favs
        )


@dataclass
class RecommendationItem:
    slug: str
    score: float
    source: str
    explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slug": self.slug,
            "score": round(self.score, 4),
            "source": self.source,
            "explanation": self.explanation
        }


@dataclass
class SimilarTalkItem:
    slug: str
    title: str
    speaker: str
    similarity_score: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slug": self.slug,
            "title": self.title,
            "speaker": self.speaker,
            "similarity_score": round(self.similarity_score, 4)
        }

