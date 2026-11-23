"""Content-based feature extraction and vectorization module."""

from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix, save_npz, load_npz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize


def build_weighted_text_corpus(df: pd.DataFrame) -> List[str]:
    """Construct a weighted text corpus where key metadata fields receive higher term frequency.
    
    Field Weights:
      - Title: 3x repetition
      - Tags: 2x repetition
      - Speaker & Occupation: 2x repetition
      - Description: 1.5x (represented once with title/tags boosting)
      - Transcript: 1x (raw full text)
    """
    corpus = []
    for _, row in df.iterrows():
        title = str(row.get("title", ""))
        speaker = str(row.get("main_speaker", ""))
        occ = str(row.get("speaker_occupation", ""))
        tags_raw = row.get("parsed_tags", [])
        if isinstance(tags_raw, str):
            tags_str = tags_raw
        elif isinstance(tags_raw, list):
            tags_str = " ".join(tags_raw)
        else:
            tags_str = ""
        desc = str(row.get("description", ""))
        trans = str(row.get("transcript", ""))

        # Boosted composite text
        text_parts = [
            title, title, title,  # 3x title boost
            speaker, speaker,     # 2x speaker boost
            occ,                  # 1x occupation
            tags_str, tags_str,   # 2x tags boost
            desc,                 # 1x description
            trans                 # 1x transcript
        ]
        corpus.append(" ".join(filter(None, text_parts)).strip())
    return corpus


def fit_content_tfidf(
    talks_df: pd.DataFrame,
    max_features: int = 15000,
    ngram_range: Tuple[int, int] = (1, 2),
    min_df: int = 2,
    max_df: float = 0.90
) -> Tuple[TfidfVectorizer, csr_matrix]:
    """Fit TF-IDF vectorizer over the complete talk catalog unsupervised.
    
    Because TF-IDF relies solely on item text attributes (unsupervised), fitting across
    the entire catalog contains zero user interaction labels and introduces zero label leakage.
    """
    corpus = build_weighted_text_corpus(talks_df)
    vectorizer = TfidfVectorizer(
        max_features=max_features,
        ngram_range=ngram_range,
        min_df=min_df,
        max_df=max_df,
        stop_words="english",
        sublinear_tf=True
    )
    tfidf_matrix = vectorizer.fit_transform(corpus)
    # Ensure L2 normalized rows for fast cosine similarity via dot product
    tfidf_matrix = normalize(tfidf_matrix, norm="l2", axis=1)
    return vectorizer, tfidf_matrix

