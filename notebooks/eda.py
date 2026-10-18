
import pandas as pd
import matplotlib.pyplot as plt

# Load the cleaned dataset
df = pd.read_csv("data/ted_talks_clean.csv")

print("=== DATASET OVERVIEW ===")
print("Total talks:", len(df))
print("Total columns:", len(df.columns))

# 1. Find the 10 most-viewed talks
print("\n=== TOP 10 MOST-VIEWED TED TALKS ===")

top_talks = df[["title", "main_speaker", "views"]].sort_values(
    by="views", ascending=False
).head(10)

print(top_talks.to_string(index=False))

# 2. Calculate talk duration in minutes
df["duration_minutes"] = df["duration"] / 60

print("\n=== TALK DURATION STATISTICS ===")
print(df["duration_minutes"].describe().round(2))

# 3. Plot the distribution of talk durations
# plt.figure(figsize=(10, 5))
# plt.hist(df["duration_minutes"], bins=30, edgecolor="black")
# plt.title("Distribution of TED Talk Durations")
# plt.xlabel("Duration (minutes)")
# plt.ylabel("Number of Talks")
# plt.tight_layout()
# plt.savefig("data/talk_duration_distribution.png")
# plt.show()

# 4. Plot the 10 most-viewed talks
# plt.figure(figsize=(10, 7))
# top_10 = df.nlargest(10, "views").sort_values("views")

# plt.barh(top_10["title"], top_10["views"])
# plt.title("Top 10 Most-Viewed TED Talks")
# plt.xlabel("Views")
# plt.ylabel("Talk Title")
# plt.tight_layout()
# plt.savefig("data/top_10_viewed_talks.png")
# plt.show()

print("\nEDA step 1 completed!")
print("Charts saved in the data folder.")
