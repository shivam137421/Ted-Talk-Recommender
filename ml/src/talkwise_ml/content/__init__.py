"""Content-based recommendation module for TalkWise."""

from .vectorizer import build_weighted_text_corpus, fit_content_tfidf
from .model import ContentBasedRecommender

__all__ = [
    "build_weighted_text_corpus",
    "fit_content_tfidf",
    "ContentBasedRecommender",
]

