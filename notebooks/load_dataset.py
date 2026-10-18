
import pandas as pd

# Load the TED Talks metadata
df = pd.read_csv("data/ted_main.csv")

# Display information about the dataset
print("Dataset loaded successfully!")

print("\nDataset shape:")
print(df.shape)

print("\nColumn names:")
print(df.columns.tolist())

print("\nFirst five rows:")
print(df.head())

print("\nDataset information:")
df.info()
