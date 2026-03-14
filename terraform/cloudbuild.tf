# ─────────────────────────────────────────────────────────────────────
# Cloud Build — CI/CD Trigger for Operon Server
# ─────────────────────────────────────────────────────────────────────
# Prerequisite: Install the Cloud Build GitHub App on your repository
# via the GCP Console → Cloud Build → Triggers → Connect Repository.
# This is a one-time manual step to establish the OAuth connection.
# ─────────────────────────────────────────────────────────────────────

resource "google_cloudbuild_trigger" "deploy" {
  name        = "operon-server-deploy"
  description = "Build, push, and deploy operon-server on push to main"
  location    = var.region
  project     = var.project_id

  # ── GitHub trigger ──────────────────────────────────────────────
  github {
    owner = var.github_owner
    name  = var.github_repo

    push {
      branch = "^main$"
    }
  }

  # Use the CI/CD service account (not the default Cloud Build SA)
  service_account = google_service_account.ci_sa.id

  # Reference the cloudbuild.yaml at the repository root
  filename = "cloudbuild.yaml"

  # Pass infrastructure-defined values into the build
  substitutions = {
    _REGION       = var.region
    _REPO_NAME    = google_artifact_registry_repository.server.name
    _SERVICE_NAME = var.cloud_run_service_name
  }

  # Only trigger when server code or Dockerfile changes
  included_files = [
    "server/**",
    "cloudbuild.yaml",
  ]

  depends_on = [
    google_project_service.apis,
    google_service_account.ci_sa,
  ]
}
