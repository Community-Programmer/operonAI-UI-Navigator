# ─────────────────────────────────────────────────────────────────────
# Artifact Registry — Docker Image Repository
# ─────────────────────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "server" {
  location      = var.region
  repository_id = "operon-server"
  description   = "Docker images for the Operon AI server"
  format        = "DOCKER"
  project       = var.project_id

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  labels = {
    environment = var.environment
    app         = "operon-ai"
  }

  depends_on = [google_project_service.apis]
}

# Allow Cloud Run SA to pull images
resource "google_artifact_registry_repository_iam_member" "cloud_run_reader" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.server.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Allow CI SA to push images
resource "google_artifact_registry_repository_iam_member" "ci_writer" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.server.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.ci_sa.email}"
}
