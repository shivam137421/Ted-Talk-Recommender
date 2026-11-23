"""Live verification of the TalkWise recommendation engine output."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml" / "src"))
sys.path.insert(0, str(ROOT))

from ml.service.loader import ModelManager

mgr = ModelManager.get_instance(root_dir=ROOT)

print("=" * 60)
print("1. PERSONALIZED HYBRID RECOMMENDATIONS (Favorite: Ken Robinson)")
print("=" * 60)
input_fav = "ken_robinson_says_schools_kill_creativity"
recs_fav = mgr.recommend(favorite_slugs=[input_fav], k=5)
for i, r in enumerate(recs_fav, 1):
    meta = mgr.metadata_map.get(r["slug"], {})
    print(f"  {i}. [{r['source']}] {meta.get('title')}")
    print(f"     Slug: {r['slug']}")
    print(f"     Score: {r['score']}")
    print(f"     Why: {r['explanation']}\n")

print("=" * 60)
print("2. COLD-START TOPIC RECOMMENDATIONS (Tags: Technology, Design)")
print("=" * 60)
recs_cold = mgr.recommend(favorite_slugs=[], preferred_tags=["technology", "design"], k=3)
for i, r in enumerate(recs_cold, 1):
    meta = mgr.metadata_map.get(r["slug"], {})
    print(f"  {i}. [{r['source']}] {meta.get('title')}")
    print(f"     Slug: {r['slug']}")
    print(f"     Score: {r['score']}")
    print(f"     Why: {r['explanation']}\n")

print("=" * 60)
print("3. NON-PERSONALIZED POPULARITY BASELINE (Top Views Snapshot)")
print("=" * 60)
pops = mgr.get_popular(k=3)
for i, p in enumerate(pops, 1):
    print(f"  {i}. [popularity] {p['title']}")
    print(f"     Slug: {p['slug']}")
    print(f"     Views: {int(p['score']):,}\n")

top_pers = recs_fav[0]["slug"]
top_pop = pops[0]["slug"]
print("=" * 60)
print("VERIFICATION CHECKS:")
print(f"  - Personalized #1 is NOT the popularity #1 ({top_pers} != {top_pop}): {top_pers != top_pop}")
print(f"  - Input favorite was excluded from recommendations: {input_fav not in [r['slug'] for r in recs_fav]}")
print(f"  - Scores are real normalized floats in (0, 1]: {[r['score'] for r in recs_fav]}")
print("=" * 60)

