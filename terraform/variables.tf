# ─────────────────────────────────────────────────────────────────────
# Variables — Operon AI Server on GCP
# ─────────────────────────────────────────────────────────────────────

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone (used by zonal resources)"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment label (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# ── Secrets ─────────────────────────────────────────────────────────

variable "google_api_key" {
  description = "Gemini / Vertex AI API key"
  type        = string
  sensitive   = true
}

variable "jwt_secret_key" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "mongodb_uri" {
  description = "MongoDB Atlas connection URI"
  type        = string
  sensitive   = true
}

variable "mongodb_db_name" {
  description = "MongoDB database name"
  type        = string
  default     = "ui_navigator"
}

variable "sentry_dsn" {
  description = "Sentry DSN for error tracking (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

# ── Cloud Run ───────────────────────────────────────────────────────

variable "cloud_run_service_name" {
  description = "Name for the Cloud Run service"
  type        = string
  default     = "operon-server"
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run (e.g. 2, 4)"
  type        = string
  default     = "4"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run (e.g. 2Gi, 8Gi)"
  type        = string
  default     = "8Gi"
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 1
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 5
}

variable "cloud_run_timeout" {
  description = "Request timeout in seconds (WebSocket sessions can be long)"
  type        = number
  default     = 3600
}

variable "cloud_run_concurrency" {
  description = "Max concurrent requests per instance"
  type        = number
  default     = 80
}

# ── GCS ─────────────────────────────────────────────────────────────

variable "gcs_bucket_name" {
  description = "GCS bucket for session screenshots"
  type        = string
}

variable "gcs_location" {
  description = "GCS bucket location"
  type        = string
  default     = "US"
}

variable "gcs_lifecycle_days" {
  description = "Number of days before objects are auto-deleted"
  type        = number
  default     = 30
}

# ── CORS ────────────────────────────────────────────────────────────

variable "cors_origins" {
  description = "Allowed CORS origins for the web dashboard"
  type        = string
  default     = "https://operonai.netlify.app,http://localhost:5173"
}

# ── Docker ──────────────────────────────────────────────────────────

variable "docker_image_tag" {
  description = "Docker image tag to deploy (e.g. latest, v1.0.0, sha-abc1234). Leave empty to use a placeholder for initial bootstrap."
  type        = string
  default     = ""
}

# ── CI/CD — GitHub ──────────────────────────────────────────────────

variable "github_owner" {
  description = "GitHub repository owner (user or organisation)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (e.g. operon-ai)"
  type        = string
}
