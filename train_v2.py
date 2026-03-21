import shutil
from pathlib import Path
from ultralytics import YOLO

# ── Paths ─────────────────────────────────────────────────────────────────────
DATASET_YAML = "/mnt/d/Swachh AI/dataset/data.yaml"
OUTPUT_DIR   = "/mnt/d/Swachh AI/training_runs"
OUTPUT_NAME  = "swachh_ai_v2"
FINAL_MODEL  = "/mnt/d/Swachh AI/best_v2.pt"

print("=" * 60)
print("  Swachh AI v2 — Training Started")
print("  Dataset   : 42-class waste detection (bounding boxes)")
print("  Model     : YOLOv8-Large")
print("  GPU       : RTX 5070 Ti")
print("  Epochs    : 100")
print("  Est. time : 35-50 minutes")
print("=" * 60 + "\n")

# ── Load pretrained model ─────────────────────────────────────────────────────
model = YOLO("yolov8l.pt")

# ── Train ─────────────────────────────────────────────────────────────────────
results = model.train(
    data=DATASET_YAML,
    task="detect",             # detection — gives bounding boxes

    # Core
    epochs=100,
    batch=16,                  # 16 safe for 12GB VRAM with large model
    imgsz=640,

    # Optimizer
    optimizer="AdamW",
    lr0=0.001,
    lrf=0.01,
    momentum=0.937,
    weight_decay=0.0005,
    warmup_epochs=3,
    warmup_momentum=0.8,

    # Augmentation
    hsv_h=0.015,
    hsv_s=0.7,
    hsv_v=0.4,
    degrees=10.0,
    translate=0.1,
    scale=0.5,
    fliplr=0.5,
    mosaic=1.0,
    mixup=0.1,
    copy_paste=0.1,

    # Hardware
    device=0,
    workers=8,
    amp=True,
    cache=True,

    # Output
    project=OUTPUT_DIR,
    name=OUTPUT_NAME,
    save=True,
    save_period=10,
    patience=20,
    plots=True,
    verbose=True,
)

# ── Save best model ───────────────────────────────────────────────────────────
best_pt = Path(OUTPUT_DIR) / OUTPUT_NAME / "weights" / "best.pt"

if best_pt.exists():
    shutil.copy(str(best_pt), FINAL_MODEL)
    print("\n" + "=" * 60)
    print("  ✅ Training Complete!")
    print(f"  ✅ Model saved: {FINAL_MODEL}")
try:
    if results is not None and hasattr(results, 'results_dict'):
        print(f"  ✅ mAP50     : {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")
        print(f"  ✅ mAP50-95  : {results.results_dict.get('metrics/mAP50-95(B)', 'N/A')}")
        print(f"  ✅ Precision : {results.results_dict.get('metrics/precision(B)', 'N/A')}")
        print(f"  ✅ Recall    : {results.results_dict.get('metrics/recall(B)', 'N/A')}")
except Exception:
    pass
    print("=" * 60)
    print("\nNext step: Tell me — I will give you the dual-model ai_classifier.py")
else:
    print(f"\n❌ best.pt not found at: {best_pt}")
    print("   Check training_runs/swachh_ai_v2/weights/ manually")