
import pandas as pd

# Load the dataset
df = pd.read_csv("data/ted_main.csv")

# 1. Check missing values
print("=== MISSING VALUES ===")
print(df.isnull().sum())

# 2. Count all missing cells
print("\nTotal missing cells:")
print(df.isnull().sum().sum())

# 3. Check duplicate rows
print("\n=== DUPLICATE ROWS ===")
print("Number of duplicate rows:", df.duplicated().sum())

# 4. Check duplicate talk titles
print("\n=== DUPLICATE TITLES ===")
print("Number of duplicate titles:", df["title"].duplicated().sum())

# 5. Check for empty titles
print("\n=== EMPTY TITLES ===")
print("Number of empty titles:", df["title"].isna().sum())

print("\nData quality check completed!")
