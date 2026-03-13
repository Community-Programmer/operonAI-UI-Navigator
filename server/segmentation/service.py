from __future__ import annotations

import base64
import io
import threading
import time
from typing import Any

from PIL import Image

from server.segmentation.segmenter import UISegmenter

_segmenter_instance: UISegmenter | None = None
_segmenter_lock = threading.Lock()


def get_segmenter() -> UISegmenter:
    global _segmenter_instance
    if _segmenter_instance is None:
        with _segmenter_lock:
            if _segmenter_instance is None:
                _segmenter_instance = UISegmenter()
    return _segmenter_instance


def _decode_image(image_b64: str) -> Image.Image:
    raw = base64.b64decode(image_b64)
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _encode_jpeg_base64(image: Image.Image, quality: int = 60) -> str:
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def _scale_to_logical(
    detections: list[dict[str, Any]],
    scale_factor: float,
) -> None:
    if scale_factor == 1.0:
        return

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        det["bbox"] = [
            int(x1 / scale_factor),
            int(y1 / scale_factor),
            int(x2 / scale_factor),
            int(y2 / scale_factor),
        ]
        det["center_x"] = int(det["center_x"] / scale_factor)
        det["center_y"] = int(det["center_y"] / scale_factor)


def segment_screenshot_payload(
    image_b64: str,
    logical_width: int,
    logical_height: int,
    scale_factor: float,
    quality: int = 60,
) -> dict[str, Any]:
    start = time.perf_counter()

    if not image_b64:
        raise ValueError("image_b64 is required")

    image = _decode_image(image_b64)
    segmenter = get_segmenter()

    annotated, detections = segmenter.segment(image)

    # Keep element coordinates in logical desktop space expected by pyautogui.
    _scale_to_logical(detections, scale_factor)

    if logical_width > 0 and logical_height > 0:
        annotated = annotated.resize((logical_width, logical_height), Image.Resampling.LANCZOS)

    annotated_b64 = _encode_jpeg_base64(annotated, quality=quality)

    confidence_values = [float(det.get("confidence", 0.0)) for det in detections]
    avg_conf = (sum(confidence_values) / len(confidence_values)) if confidence_values else 0.0

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    return {
        "screenshot": annotated_b64,
        "elements": detections,
        "screen_info": {
            "scale_factor": scale_factor,
            "screen_width": logical_width,
            "screen_height": logical_height,
        },
        "stats": {
            "latency_ms": elapsed_ms,
            "num_elements": len(detections),
            "avg_confidence": round(avg_conf, 4),
        },
    }
