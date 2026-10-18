
import pandas as pd
from collections import Counter
import ast

# Load cleaned dataset
df = pd.read_csv("data/ted_talks_clean.csv")

# Convert the tags column from text into Python lists
def parse_tags(tag_value):
    try:
        return ast.literal_eval(tag_value)
    except (ValueError, SyntaxError):
        return []

df["tags_list"] = df["tags"].apply(parse_tags)

# Count how often each tag appears
all_tags = [
    tag
    for tag_list in df["tags_list"]
    for tag in tag_list
]

tag_counts = Counter(all_tags)

print("=== TOP 20 TED TALK TOPICS ===")
for tag, count in tag_counts.most_common(20):
    print(f"{tag}: {count}")

# Display the number of unique topics
print("\nTotal unique topics:", len(tag_counts))

# Show example tags for five talks
print("\n=== EXAMPLE TALK TITLES AND TAGS ===")
for _, row in df[["title", "tags_list"]].head(5).iterrows():
    print(f"\nTitle: {row['title']}")
    print(f"Tags: {', '.join(row['tags_list'])}")

print("\nTopic analysis completed!")
