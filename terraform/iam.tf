# ─────────────────────────────────────────────────────────────────────
# IAM — Service Accounts, Roles & Keys
# ─────────────────────────────────────────────────────────────────────

# ── Cloud Run service account ───────────────────────────────────────

resource "google_service_account" "cloud_run_sa" {
  account_id   = "operon-server-sa"
  display_name = "Operon AI Server (Cloud Run)"
  description  = "Service account used by the Operon server Cloud Run service"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

# Roles needed by the server at runtime
locals {
  cloud_run_sa_roles = [
    # GCS — upload screenshots, generate signed URLs
    "roles/storage.objectAdmin",
    # Secret Manager — read secrets injected as env vars
    "roles/secretmanager.secretAccessor",
    # Vertex AI — call Gemini models
    "roles/aiplatform.user",
    # Logging & monitoring (best practice)
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ]
}

resource "google_project_iam_member" "cloud_run_sa_roles" {
  for_each = toset(local.cloud_run_sa_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# ── Service account key (JSON) for local development / CI ───────────
#
# WARNING: Prefer Workload Identity Federation for CI/CD.  This key is
# provided for bootstrapping & local dev convenience.  Rotate regularly.

resource "google_service_account_key" "cloud_run_sa_key" {
  service_account_id = google_service_account.cloud_run_sa.name
  key_algorithm      = "KEY_ALG_RSA_2048"
}

# ── CI / Cloud Build service account ────────────────────────────────

resource "google_service_account" "ci_sa" {
  account_id   = "operon-ci-sa"
  display_name = "Operon AI CI / Cloud Build"
  description  = "Service account for building & deploying container images"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

locals {
  ci_sa_roles = [
    # Push images to Artifact Registry
    "roles/artifactregistry.writer",
    # Deploy to Cloud Run
    "roles/run.admin",
    # Allow the CI SA to act as the Cloud Run SA
    "roles/iam.serviceAccountUser",
    # Build images with Cloud Build
    "roles/cloudbuild.builds.editor",
    # Write build logs (required when using a custom service account)
    "roles/logging.logWriter",
  ]
}

resource "google_project_iam_member" "ci_sa_roles" {
  for_each = toset(local.ci_sa_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.ci_sa.email}"
}

resource "google_service_account_key" "ci_sa_key" {
  service_account_id = google_service_account.ci_sa.name
  key_algorithm      = "KEY_ALG_RSA_2048"
}
