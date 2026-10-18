
import pandas as pd

# Load the original dataset
df = pd.read_csv("data/ted_main.csv")

print("Original dataset shape:", df.shape)

# Handle missing speaker occupations
df["speaker_occupation"] = df["speaker_occupation"].fillna("Unknown")

# Check missing values after cleaning
print("\nMissing values after cleaning:")
print(df.isnull().sum().sum())

# Save the cleaned dataset
df.to_csv("data/ted_talks_clean.csv", index=False)

print("\nCleaned dataset saved successfully!")
print("Final dataset shape:", df.shape)
