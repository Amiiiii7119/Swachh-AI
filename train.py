import os
import yaml
import torch
import shutil
from pathlib import Path
from ultralytics import YOLO
import random


class Config:
    # ✅ FAST PATH (WSL native)
    DATASET_PATH = "/home/ami/classification-1 copy"

    OUTPUT_DIR = "./runs/waste_segregation"
    MODEL_NAME = "yolov8m.pt"

    EPOCHS = 40
    BATCH_SIZE = 18    
    IMGSZ = 640
    WORKERS = 4          
    DEVICE = 0

    PATIENCE = 10
    DROP_RATE = 0.2
    MOSAIC = 1.0



def prepare_yolo_dataset(config):
    print("🔄 Preparing dataset...")

    yolo_path = Path("./yolo_dataset")

    
    if (yolo_path / "data.yaml").exists():
        print("✅ Dataset already exists, skipping preparation")
        return yolo_path / "data.yaml"

    if yolo_path.exists():
        shutil.rmtree(yolo_path)

    classes = ['food_waste', 'metal', 'paper', 'plastic']

    for split in ['train', 'val']:
        Path(yolo_path / split / 'images').mkdir(parents=True, exist_ok=True)
        Path(yolo_path / split / 'labels').mkdir(parents=True, exist_ok=True)

    all_images = []

    for idx, class_name in enumerate(classes):
        class_path = Path(config.DATASET_PATH) / class_name

        if not class_path.exists():
            raise FileNotFoundError(f"{class_path} not found")

        images = list(class_path.glob('*.jpg')) + \
                 list(class_path.glob('*.png')) + \
                 list(class_path.glob('*.jpeg'))

        print(f"{class_name}: {len(images)} images")

        for img_path in images:
            all_images.append((img_path, idx))

    random.shuffle(all_images)

    split_idx = int(0.8 * len(all_images))
    train_images = all_images[:split_idx]
    val_images = all_images[split_idx:]

    print(f"Train: {len(train_images)} | Val: {len(val_images)}")

    def process(images, split):
        for i, (img_path, class_id) in enumerate(images):
            if i % 2000 == 0:
                print(f"{split}: processed {i}")

            dest_img = yolo_path / split / 'images' / img_path.name
            shutil.copy2(img_path, dest_img)

            label_path = yolo_path / split / 'labels' / f"{img_path.stem}.txt"
            with open(label_path, 'w') as f:
                f.write(f"{class_id} 0.5 0.5 1.0 1.0\n")

    process(train_images, 'train')
    process(val_images, 'val')

    data_yaml = {
        'path': str(yolo_path.absolute()),
        'train': 'train/images',
        'val': 'val/images',
        'nc': 4,
        'names': classes
    }

    yaml_path = yolo_path / 'data.yaml'
    with open(yaml_path, 'w') as f:
        yaml.dump(data_yaml, f)

    print("✅ Dataset ready")
    return yaml_path



def train_model(data_yaml):
    print("\n🚀 Training starting...")

    print("CUDA:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("GPU:", torch.cuda.get_device_name(0))

    model = YOLO(Config.MODEL_NAME)

    model.train(
        data=str(data_yaml),

        epochs=Config.EPOCHS,
        batch=Config.BATCH_SIZE,
        imgsz=Config.IMGSZ,
        workers=Config.WORKERS,
        device=Config.DEVICE,

        optimizer='AdamW',
        lr0=0.001,
        lrf=0.01,
        weight_decay=0.0005,

        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=5.0,
        translate=0.1,
        scale=0.5,
        fliplr=0.5,
        mosaic=Config.MOSAIC,
        mixup=0.1,

        dropout=Config.DROP_RATE,

        patience=Config.PATIENCE,
        save=True,
        project=Config.OUTPUT_DIR,
        name='exp',
        exist_ok=True,

        amp=True,
        cache=True     
    )

    print("✅ Training complete")
    return model



def evaluate_and_export(model):
    print("\n📊 Evaluating...")

    metrics = model.val()
    print(f"mAP50: {metrics.box.map50:.4f}")

    best_model = Path(Config.OUTPUT_DIR) / 'exp' / 'weights' / 'best.pt'

    if not best_model.exists():
        raise RuntimeError("best.pt not found")

    shutil.copy(best_model, "./deployment_model.pt")

    print("✅ Model saved as deployment_model.pt")



if __name__ == "__main__":
    if not os.path.exists(Config.DATASET_PATH):
        print(f"❌ Dataset not found: {Config.DATASET_PATH}")
        exit(1)

    data_yaml = prepare_yolo_dataset(Config)

    model = train_model(data_yaml)

    evaluate_and_export(model)

    print("\n🎉 DONE. MODEL READY")