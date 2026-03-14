# ─────────────────────────────────────────────────────────────────────
# Google Cloud Storage — Session Screenshot Bucket
# ─────────────────────────────────────────────────────────────────────

resource "google_storage_bucket" "screenshots" {
  name     = var.gcs_bucket_name
  location = var.gcs_location
  project  = var.project_id

  # Prevent accidental deletion of the bucket
  force_destroy = false

  # Uniform bucket-level access (recommended over per-object ACLs)
  uniform_bucket_level_access = true

  # Versioning — off for screenshots (they are immutable session artefacts)
  versioning {
    enabled = false
  }

  # Auto-delete screenshots after N days to control costs
  lifecycle_rule {
    condition {
      age = var.gcs_lifecycle_days
    }
    action {
      type = "Delete"
    }
  }

  # CORS — allow the web dashboard to load signed URLs directly
  cors {
    origin          = split(",", var.cors_origins)
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Content-Length"]
    max_age_seconds = 3600
  }

  labels = {
    environment = var.environment
    app         = "operon-ai"
    purpose     = "session-screenshots"
  }

  depends_on = [google_project_service.apis]
}

# Grant the Cloud Run SA full object control on this bucket
resource "google_storage_bucket_iam_member" "server_bucket_access" {
  bucket = google_storage_bucket.screenshots.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}
