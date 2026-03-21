from pathlib import Path

yaml_path = Path("/mnt/d/Swachh AI/dataset/data.yaml")
dataset_path = Path("/mnt/d/Swachh AI/dataset")

# Check what folders exist
print("Folders in dataset:", [d.name for d in dataset_path.iterdir() if d.is_dir()])

# Fix yaml with absolute paths
content = f"""path: /mnt/d/Swachh AI/dataset
train: train/images
val: valid/images
test: test/images

nc: 42
names: ['Aerosols', 'Aluminum can', 'Aluminum caps', 'Cardboard', 'Cellulose', 'Ceramic', 'Combined plastic', 'Container for household chemicals', 'Disposable tableware', 'Electronics', 'Foil', 'Furniture', 'Glass bottle', 'Iron utensils', 'Liquid', 'Metal shavings', 'Milk bottle', 'Organic', 'Paper bag', 'Paper cups', 'Paper shavings', 'Paper', 'Papier mache', 'Plastic bag', 'Plastic bottle', 'Plastic can', 'Plastic canister', 'Plastic caps', 'Plastic cup', 'Plastic shaker', 'Plastic shavings', 'Plastic toys', 'Postal packaging', 'Printing industry', 'Scrap metal', 'Stretch film', 'Tetra pack', 'Textile', 'Tin', 'Unknown plastic', 'Wood', 'Zip plastic bag']
"""

yaml_path.write_text(content)
print("data.yaml fixed!")
print(content)
