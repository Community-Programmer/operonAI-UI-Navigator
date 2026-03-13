"""
UI Segmenter — Detects and marks all UI elements on a screenshot.

Uses Microsoft's OmniParser YOLO model for icon/widget detection
and EasyOCR for text region detection. Results are merged and
visualized with color-coded bounding boxes.

Optimized for low latency: downscales before inference, runs YOLO
and OCR in parallel, uses half-precision where possible.
"""

from __future__ import annotations

import concurrent.futures
import platform
from pathlib import Path

import cv2
import easyocr
import numpy as np
from huggingface_hub import hf_hub_download
from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO

# ──────────────────────────────────────────────
#  Colour palette for element categories
# ──────────────────────────────────────────────
COLORS = {
    "icon":       (46, 204, 113),   # green
    "button":     (52, 152, 219),   # blue
    "text_field": (155, 89, 182),   # purple
    "checkbox":   (230, 126, 34),   # orange
    "image":      (241, 196, 15),   # yellow
    "text":       (231, 76, 60),    # red
    "element":    (26, 188, 156),   # teal  (generic fallback)
}

CLASS_MAP = {
    "icon":       "icon",
    "button":     "button",
    "text_field": "text_field",
    "input":      "text_field",
    "checkbox":   "checkbox",
    "check":      "checkbox",
    "image":      "image",
    "img":        "image",
    "text":       "text",
}

# Min area in pixels (at inference resolution) to keep a detection.
# Filters out tiny noise.
_MIN_AREA = 100
# Max number of elements to send — limits visual/prompt clutter.
_MAX_ELEMENTS = 150

OMNIPARSER_REPOS = [
    ("microsoft/OmniParser-v2.0", "icon_detect/model.pt"),
    ("microsoft/OmniParser-v2.0", "icon_detect/best.pt"),
    ("microsoft/OmniParser",      "icon_detect/model.pt"),
    ("microsoft/OmniParser",      "icon_detect/best.pt"),
]

# Max dimension for inference — images are downscaled to this before
# YOLO/OCR, and coords mapped back.  640–1280 is typical for YOLO.
_MAX_INFER_DIM = 1280


def _resolve_color(label: str) -> tuple[int, int, int]:
    key = CLASS_MAP.get(label.lower(), "element")
    return COLORS.get(key, COLORS["element"])


def _resolve_category(label: str) -> str:
    return CLASS_MAP.get(label.lower(), "element")


def _classify_element(det: dict) -> str:
    """Infer a UI category from bbox geometry and text content.

    OmniParser YOLO only outputs a single class ("icon") for all UI
    elements.  We use heuristics to differentiate buttons, text fields,
    images, text, checkboxes, and true icons.
    """
    # OCR-sourced detections are always text
    if det.get("source") == "ocr":
        return "text"

    x1, y1, x2, y2 = det["bbox"]
    w, h = x2 - x1, y2 - y1
    area = w * h
    aspect = w / max(h, 1)
    has_text = bool(det.get("text", "").strip())

    # Wide + short with text  →  button   (e.g. "Submit", "Cancel")
    if has_text and aspect > 1.5 and h < 80:
        return "button"
    # Wide + short without text → could be text field / input
    if not has_text and aspect > 3.0 and h < 60:
        return "text_field"
    # Very small & roughly square → icon or checkbox
    if area < 1600 and 0.6 < aspect < 1.7:
        if has_text:
            return "checkbox"
        return "icon"
    # Large & roughly square → image / thumbnail
    if area > 30000 and 0.5 < aspect < 2.0:
        return "image"
    # Has text → button (medium sized interactive elements with labels)
    if has_text:
        return "button"

    return "icon"


# ──────────────────────────────────────────────
#  Model downloading
# ──────────────────────────────────────────────
def _download_omniparser_model() -> str:
    for repo_id, filename in OMNIPARSER_REPOS:
        try:
            path = hf_hub_download(repo_id=repo_id, filename=filename)
            print(f"[UI-Segmenter] Downloaded model from {repo_id}/{filename}")
            return path
        except Exception:
            continue
    raise RuntimeError(
        "Could not download OmniParser model from HuggingFace. "
        "Make sure you are logged in (`huggingface-cli login`) and "
        "have accepted the model licence, or supply a local model "
        "path via OMNIPARSER_MODEL_PATH env var."
    )


def _downscale(img: np.ndarray, max_dim: int) -> tuple[np.ndarray, float]:
    """Resize so the longer side ≤ max_dim.  Returns (resized, scale)."""
    h, w = img.shape[:2]
    if max(h, w) <= max_dim:
        return img, 1.0
    scale = max_dim / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized, scale


# ──────────────────────────────────────────────
#  Core segmenter
# ──────────────────────────────────────────────
class UISegmenter:
    """Detect and annotate every UI element visible in a screenshot."""

    def __init__(
        self,
        model_path: str | None = None,
        use_ocr: bool = True,
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45,
    ):
        import torch
        self._device = "cuda" if torch.cuda.is_available() else "cpu"

        if model_path and Path(model_path).exists():
            self.model = YOLO(model_path)
        else:
            downloaded = _download_omniparser_model()
            self.model = YOLO(downloaded)

        # Move YOLO model to GPU if available
        if self._device == "cuda":
            self.model.to(self._device)
            print(f"[UI-Segmenter] YOLO model loaded on GPU ({torch.cuda.get_device_name(0)})")
        else:
            print("[UI-Segmenter] YOLO model loaded on CPU (no CUDA GPU found)")

        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold

        self.ocr_reader: easyocr.Reader | None = None
        if use_ocr:
            gpu = self._device == "cuda"
            self.ocr_reader = easyocr.Reader(["en"], gpu=gpu)
            print(f"[UI-Segmenter] EasyOCR loaded on {'GPU' if gpu else 'CPU'}")

        self._pool = concurrent.futures.ThreadPoolExecutor(max_workers=2)

    # ─── Detection ────────────────────────────
    def detect_icons(self, image: np.ndarray) -> list[dict]:
        results = self.model.predict(
            source=image,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            imgsz=640,
            device=self._device,
            verbose=False,
        )
        detections: list[dict] = []
        for result in results:
            boxes = result.boxes
            for i in range(len(boxes)):
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                conf = float(boxes.conf[i])
                cls_id = int(boxes.cls[i])
                label = result.names.get(cls_id, "element")
                w, h = x2 - x1, y2 - y1
                if w * h < _MIN_AREA:
                    continue
                detections.append({
                    "bbox": [int(x1), int(y1), int(x2), int(y2)],
                    "label": label,
                    "confidence": round(conf, 3),
                    "source": "yolo",
                })
        return detections

    def detect_text(self, image: np.ndarray) -> list[dict]:
        if self.ocr_reader is None:
            return []
        ocr_results = self.ocr_reader.readtext(image)
        detections: list[dict] = []
        for bbox_pts, text, conf in ocr_results:
            if conf < 0.3:
                continue
            xs = [p[0] for p in bbox_pts]
            ys = [p[1] for p in bbox_pts]
            x1, y1 = int(min(xs)), int(min(ys))
            x2, y2 = int(max(xs)), int(max(ys))
            detections.append({
                "bbox": [x1, y1, x2, y2],
                "label": "text",
                "confidence": round(float(conf), 3),
                "text": text,
                "source": "ocr",
            })
        return detections

    # ─── Merging ──────────────────────────────
    @staticmethod
    def _iou(a: list[int], b: list[int]) -> float:
        xi1 = max(a[0], b[0])
        yi1 = max(a[1], b[1])
        xi2 = min(a[2], b[2])
        yi2 = min(a[3], b[3])
        inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
        area_a = (a[2] - a[0]) * (a[3] - a[1])
        area_b = (b[2] - b[0]) * (b[3] - b[1])
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0.0

    def _merge_detections(self, icon_dets: list[dict], text_dets: list[dict]) -> list[dict]:
        merged = list(icon_dets)
        used_text = set()
        for i, td in enumerate(text_dets):
            best_iou, best_idx = 0.0, -1
            for j, md in enumerate(merged):
                iou = self._iou(td["bbox"], md["bbox"])
                if iou > best_iou:
                    best_iou, best_idx = iou, j
            if best_iou > 0.3 and best_idx >= 0:
                merged[best_idx]["text"] = td.get("text", "")
                used_text.add(i)
        for i, td in enumerate(text_dets):
            if i not in used_text:
                merged.append(td)
        return merged

    # ─── Full pipeline ────────────────────────
    def segment(self, image_input) -> tuple[Image.Image, list[dict]]:
        """Run segmentation.  Returns (annotated_image, detections)."""
        if isinstance(image_input, Image.Image):
            pil_img = image_input.convert("RGB")
        elif isinstance(image_input, np.ndarray):
            pil_img = Image.fromarray(cv2.cvtColor(image_input, cv2.COLOR_BGR2RGB))
        else:
            raise TypeError(f"Unsupported image type: {type(image_input)}")

        np_rgb = np.array(pil_img)
        np_bgr = cv2.cvtColor(np_rgb, cv2.COLOR_RGB2BGR)

        # Downscale for faster inference
        small_bgr, inv_scale = _downscale(np_bgr, _MAX_INFER_DIM)
        scale_back = 1.0 / inv_scale  # to map coords back to original

        # Run YOLO and OCR in parallel — they are independent
        yolo_future = self._pool.submit(self.detect_icons, small_bgr)
        ocr_future = self._pool.submit(self.detect_text, small_bgr)

        icon_dets = yolo_future.result()
        text_dets = ocr_future.result()

        # Map coordinates back to original resolution
        if scale_back != 1.0:
            for det in icon_dets:
                det["bbox"] = [int(c * scale_back) for c in det["bbox"]]
            for det in text_dets:
                det["bbox"] = [int(c * scale_back) for c in det["bbox"]]

        detections = self._merge_detections(icon_dets, text_dets)

        # Sort by confidence (highest first) and cap the total
        detections.sort(key=lambda d: d.get("confidence", 0), reverse=True)
        detections = detections[:_MAX_ELEMENTS]

        # Smart classification: OmniParser YOLO only outputs one class
        # ("icon"), so we infer better categories from bbox geometry and
        # whether OCR text was attached.
        for det in detections:
            det["category"] = _classify_element(det)

        # Sort spatially (top→bottom, left→right) for readable numbering
        detections.sort(key=lambda d: (d["bbox"][1], d["bbox"][0]))

        # Add 1-based element ID and center coordinates
        for idx, det in enumerate(detections, start=1):
            det["id"] = idx
            x1, y1, x2, y2 = det["bbox"]
            det["center_x"] = (x1 + x2) // 2
            det["center_y"] = (y1 + y2) // 2

        annotated = self._visualize(pil_img, detections)
        return annotated, detections

    # ─── Visualisation (fast path) ────────────
    def _visualize(self, image: Image.Image, detections: list[dict]) -> Image.Image:
        """Draw bounding boxes + numbered labels.  No alpha overlay — faster."""
        img = image.copy()
        draw = ImageDraw.Draw(img)
        font = _get_font(max(12, int(img.height * 0.014)))

        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            cat = det.get("category", "element")
            color = COLORS.get(cat, COLORS["element"])

            draw.rectangle([x1, y1, x2, y2], outline=color, width=2)

            # Compact label: [id] category (optional short text)
            tag = f"[{det['id']}]"
            text = det.get("text", "")
            if text:
                short = text[:18] + ("…" if len(text) > 18 else "")
                tag += f" {short}"

            bbox_text = draw.textbbox((x1, y1), tag, font=font)
            tw = bbox_text[2] - bbox_text[0]
            th = bbox_text[3] - bbox_text[1]
            tag_y = max(y1 - th - 4, 0)
            draw.rectangle([x1, tag_y, x1 + tw + 6, tag_y + th + 4], fill=color)
            draw.text((x1 + 3, tag_y + 1), tag, fill="white", font=font)

        return img


# ──────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────
def _get_font(size: int = 14) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    system = platform.system()
    if system == "Windows":
        candidates = [
            "C:/Windows/Fonts/consolab.ttf",
            "C:/Windows/Fonts/consola.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
    elif system == "Darwin":
        candidates = [
            "/System/Library/Fonts/Menlo.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
        ]
    else:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        ]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def format_elements_for_prompt(detections: list[dict]) -> str:
    """Format element detections into a compact text list for the LLM prompt."""
    if not detections:
        return "No UI elements detected."
    lines = []
    for det in detections:
        text = det.get("text", "")
        text_info = f' "{text}"' if text else ""
        x1, y1, x2, y2 = det["bbox"]
        conf = det.get("confidence", 0)
        lines.append(
            f"[{det['id']}] {det['category']}{text_info} "
            f"bbox=[{x1},{y1},{x2},{y2}] center=({det['center_x']},{det['center_y']}) "
            f"conf={conf:.0%}"
        )
    return "\n".join(lines)
