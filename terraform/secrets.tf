# ─────────────────────────────────────────────────────────────────────
# Secret Manager — Application Secrets
# ─────────────────────────────────────────────────────────────────────

# ── Google / Gemini API Key ─────────────────────────────────────────

resource "google_secret_manager_secret" "google_api_key" {
  secret_id = "operon-google-api-key"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    app         = "operon-ai"
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "google_api_key" {
  secret      = google_secret_manager_secret.google_api_key.id
  secret_data = var.google_api_key
}

# ── JWT Secret Key ──────────────────────────────────────────────────

resource "google_secret_manager_secret" "jwt_secret_key" {
  secret_id = "operon-jwt-secret-key"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    app         = "operon-ai"
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "jwt_secret_key" {
  secret      = google_secret_manager_secret.jwt_secret_key.id
  secret_data = var.jwt_secret_key
}

# ── MongoDB URI ─────────────────────────────────────────────────────

resource "google_secret_manager_secret" "mongodb_uri" {
  secret_id = "operon-mongodb-uri"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    app         = "operon-ai"
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "mongodb_uri" {
  secret      = google_secret_manager_secret.mongodb_uri.id
  secret_data = var.mongodb_uri
}

# ── Sentry DSN (optional) ──────────────────────────────────────────

resource "google_secret_manager_secret" "sentry_dsn" {
  secret_id = "operon-sentry-dsn"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    app         = "operon-ai"
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "sentry_dsn" {
  secret      = google_secret_manager_secret.sentry_dsn.id
  secret_data = var.sentry_dsn != "" ? var.sentry_dsn : "unused"
}

# ── Grant Cloud Run SA access to read all secrets ───────────────────

locals {
  secret_ids = [
    google_secret_manager_secret.google_api_key.secret_id,
    google_secret_manager_secret.jwt_secret_key.secret_id,
    google_secret_manager_secret.mongodb_uri.secret_id,
    google_secret_manager_secret.sentry_dsn.secret_id,
  ]
}

resource "google_secret_manager_secret_iam_member" "cloud_run_secret_access" {
  for_each = toset(local.secret_ids)

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}
