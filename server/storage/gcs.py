"""Google Cloud Storage service for uploading agent session screenshots.

Organizes images as:
  gs://<bucket>/sessions/<session_id>/iter_<N>_<timestamp>.jpg

Falls back gracefully when credentials are missing — logs a warning and
returns None so the rest of the system continues working.
"""

from __future__ import annotations

import base64
import logging
import os
from datetime import datetime, timezone

from google.cloud import storage as gcs

from server.config import GCS_BUCKET_NAME

logger = logging.getLogger(__name__)

_client: gcs.Client | None = None
_bucket: gcs.Bucket | None = None


def _get_bucket() -> gcs.Bucket | None:
    """Lazy-init the GCS client and bucket."""
    global _client, _bucket
    if _bucket is not None:
        return _bucket
    if not GCS_BUCKET_NAME:
        logger.warning("GCS_BUCKET_NAME not set — screenshot upload disabled")
        return None
    try:
        _client = gcs.Client()
        _bucket = _client.bucket(GCS_BUCKET_NAME)
        logger.info("GCS bucket ready: %s", GCS_BUCKET_NAME)
        return _bucket
    except Exception as exc:
        logger.warning("GCS init failed (uploads disabled): %s", exc)
        return None


def upload_screenshot(
    session_id: str,
    iteration: int,
    screenshot_b64: str,
    *,
    subfolder: str = "screenshots",
) -> str | None:
    """Upload a base64-encoded JPEG screenshot to GCS.

    Returns the public URL on success, or None on failure.
    """
    bucket = _get_bucket()
    if bucket is None:
        return None

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    blob_path = f"sessions/{session_id}/{subfolder}/iter_{iteration:03d}_{ts}.jpg"

    try:
        image_bytes = base64.b64decode(screenshot_b64)
        blob = bucket.blob(blob_path)
        blob.upload_from_string(image_bytes, content_type="image/jpeg")
        url = blob.public_url
        logger.debug("Uploaded screenshot: %s", url)
        return url
    except Exception as exc:
        logger.warning("Screenshot upload failed: %s", exc)
        return None


def upload_verification_screenshot(
    session_id: str,
    iteration: int,
    screenshot_b64: str,
) -> str | None:
    """Upload a verification screenshot (separate subfolder)."""
    return upload_screenshot(
        session_id, iteration, screenshot_b64, subfolder="verifications"
    )
