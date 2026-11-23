"""Slug extraction and text normalization utilities for TalkWise."""

import re
from typing import Optional


def extract_canonical_slug(url: Optional[str]) -> str:
    """Extract a canonical talk slug from a TED Talk URL or path.
    
    Examples:
        'https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity\\n'
        -> 'ken_robinson_says_schools_kill_creativity'
        'http://ted.com/talks/scott_fraser_the_problem_with_eyewitness_testimony.html?lang=en#t-100'
        -> 'scott_fraser_the_problem_with_eyewitness_testimony'
    """
    if not url or not isinstance(url, str):
        return ""

    # Strip newlines, carriage returns, tabs, and spaces
    u = url.strip().strip("\r\n\t /")

    # Remove query string and fragment
    u = u.split("?")[0].split("#")[0].strip()

    # Remove protocol and domain
    u = re.sub(r"^https?://", "", u, flags=re.IGNORECASE)
    u = re.sub(r"^(www\.)?ted\.com/", "", u, flags=re.IGNORECASE)

    # Remove leading talks/ prefix if present
    u = re.sub(r"^talks/", "", u, flags=re.IGNORECASE)

    # Remove trailing .html
    u = re.sub(r"\.html$", "", u, flags=re.IGNORECASE)

    # Strip any remaining slashes or whitespace
    u = u.strip("/ \r\n\t")

    return u.lower()


def normalize_text(text: Optional[str]) -> str:
    """Normalize text by lowercasing, stripping punctuation, and collapsing whitespace.
    
    Used for resilient talk title and speaker matching across disparate datasets.
    """
    if not text or not isinstance(text, str):
        return ""
    t = text.strip().lower()
    t = re.sub(r"[^\w\s]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()

