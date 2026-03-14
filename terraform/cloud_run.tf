# ─────────────────────────────────────────────────────────────────────
# Cloud Run — Operon AI Server
# ─────────────────────────────────────────────────────────────────────

locals {
  ar_image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.server.name}/operon-server:${var.docker_image_tag}"
  # Use a public placeholder for the initial terraform apply (before the first Cloud Build run).
  # After the first build, Cloud Build manages the image and Terraform ignores changes to it.
  image_url = var.docker_image_tag != "" ? local.ar_image : "us-docker.pkg.dev/cloudrun/container/hello:latest"
}

resource "google_cloud_run_v2_service" "server" {
  name     = var.cloud_run_service_name
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.cloud_run_sa.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    # Session affinity — keep WebSocket connections on the same instance
    session_affinity = true

    # Long timeout for WebSocket sessions
    timeout = "${var.cloud_run_timeout}s"

    containers {
      image = local.image_url

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle          = false  # Keep CPU allocated (WebSocket server needs it)
        startup_cpu_boost = true
      }

      # ── Plain environment variables ─────────────────────────────
      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.screenshots.name
      }

      env {
        name  = "MONGODB_DB_NAME"
        value = var.mongodb_db_name
      }

      env {
        name  = "CORS_ORIGINS"
        value = var.cors_origins
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      # ── Secrets injected from Secret Manager ────────────────────
      env {
        name = "GOOGLE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "MONGODB_URI"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.mongodb_uri.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SENTRY_DSN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.sentry_dsn.secret_id
            version = "latest"
          }
        }
      }

      # ── Health check (startup probe) ────────────────────────────
      startup_probe {
        http_get {
          path = "/docs"
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 10
        timeout_seconds       = 3
      }

      liveness_probe {
        http_get {
          path = "/docs"
        }
        period_seconds  = 30
        timeout_seconds = 3
      }
    }
  }

  # Traffic — route 100% to the latest revision
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = {
    environment = var.environment
    app         = "operon-ai"
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_version.google_api_key,
    google_secret_manager_secret_version.jwt_secret_key,
    google_secret_manager_secret_version.mongodb_uri,
    google_secret_manager_secret_version.sentry_dsn,
    google_artifact_registry_repository.server,
  ]

  # Cloud Build manages the container image after initial creation.
  # Terraform should not revert the image on subsequent applies.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }
}

# ── Allow unauthenticated access (public API) ─────────────────────
# Remove this block if you want to require IAM authentication at the
# Cloud Run ingress level (and handle auth only via JWT in the app).

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
