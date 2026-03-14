# ─────────────────────────────────────────────────────────────────────
# Outputs — Operon AI GCP Deployment
# ─────────────────────────────────────────────────────────────────────

# ── Cloud Run ───────────────────────────────────────────────────────

output "cloud_run_url" {
  description = "Public URL of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.server.uri
}

output "cloud_run_service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_v2_service.server.name
}

# ── GCS ─────────────────────────────────────────────────────────────

output "gcs_bucket_name" {
  description = "Name of the GCS bucket for session screenshots"
  value       = google_storage_bucket.screenshots.name
}

output "gcs_bucket_url" {
  description = "GCS bucket self-link"
  value       = google_storage_bucket.screenshots.url
}

# ── Artifact Registry ──────────────────────────────────────────────

output "artifact_registry_repo" {
  description = "Full Artifact Registry repository path"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.server.name}"
}

output "docker_image_url" {
  description = "Full Docker image URL for the deployed service"
  value       = local.image_url
}

# ── IAM ─────────────────────────────────────────────────────────────

output "cloud_run_service_account_email" {
  description = "Email of the Cloud Run service account"
  value       = google_service_account.cloud_run_sa.email
}

output "ci_service_account_email" {
  description = "Email of the CI/CD service account"
  value       = google_service_account.ci_sa.email
}

# ── Cloud Build ─────────────────────────────────────────────────────

output "cloud_build_trigger_id" {
  description = "ID of the Cloud Build deploy trigger"
  value       = google_cloudbuild_trigger.deploy.trigger_id
}

output "cloud_run_sa_key_json" {
  description = "Base64-encoded JSON key for the Cloud Run service account (for local dev)"
  value       = google_service_account_key.cloud_run_sa_key.private_key
  sensitive   = true
}

output "ci_sa_key_json" {
  description = "Base64-encoded JSON key for the CI service account"
  value       = google_service_account_key.ci_sa_key.private_key
  sensitive   = true
}

# ── Secret Manager ──────────────────────────────────────────────────

output "secret_google_api_key_id" {
  description = "Secret Manager resource ID for GOOGLE_API_KEY"
  value       = google_secret_manager_secret.google_api_key.id
}

output "secret_jwt_secret_key_id" {
  description = "Secret Manager resource ID for JWT_SECRET_KEY"
  value       = google_secret_manager_secret.jwt_secret_key.id
}

output "secret_mongodb_uri_id" {
  description = "Secret Manager resource ID for MONGODB_URI"
  value       = google_secret_manager_secret.mongodb_uri.id
}

# ── Helpful commands ────────────────────────────────────────────────

output "deploy_command" {
  description = "Command to build & push a new image then update Cloud Run"
  value       = <<-EOT
    # 1. Build and push the Docker image
    docker build -t ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.server.name}/operon-server:latest -f server/Dockerfile .
    docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.server.name}/operon-server:latest

    # 2. Update Cloud Run to the new image
    gcloud run services update ${var.cloud_run_service_name} \
      --region ${var.region} \
      --image ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.server.name}/operon-server:latest
  EOT
}
