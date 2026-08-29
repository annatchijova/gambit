#!/usr/bin/env bash
#
# GAMBIT YourMove — Cloud Run deploy.
#
# Reproducible deploy to Cloud Run with the Vertex AI backend, capturing two
# non-obvious facts established on 2026-08-29 (see docs/journal.md):
#
#   1. LOCATION = global. The gemini-3.5-flash family this app pins is served
#      only from the `global` Vertex endpoint; us-central1 returns 404 for it.
#      Note this is the VERTEX location, independent of the Cloud Run --region.
#   2. The runtime service account needs roles/aiplatform.user, or the deployed
#      service authenticates but every model call is denied.
#
# No API key is used or shipped: on Cloud Run the container authenticates as its
# runtime service account (ADC), so there is no secret in the image or the env.
#
# Usage:  ./scripts/deploy.sh
set -euo pipefail

PROJECT="${GAMBIT_PROJECT:-vigia-497422}"
REGION="${GAMBIT_REGION:-us-central1}"     # Cloud Run region
SERVICE="${GAMBIT_SERVICE:-gambit-yourmove}"
VERTEX_LOCATION="global"                    # NOT us-central1 — see note above

NUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="${NUM}-compute@developer.gserviceaccount.com"

echo "Enabling required APIs…"
gcloud services enable \
  run.googleapis.com aiplatform.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project "$PROJECT"

echo "Granting Vertex AI User to the runtime service account ($SA)…"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA}" \
  --role="roles/aiplatform.user" --condition=None >/dev/null

echo "Deploying $SERVICE to Cloud Run ($REGION)…"
gcloud run deploy "$SERVICE" \
  --source . \
  --project "$PROJECT" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=${PROJECT},GOOGLE_CLOUD_LOCATION=${VERTEX_LOCATION}" \
  --memory 1Gi --cpu 1 --timeout 60 --max-instances 3 --concurrency 20

echo "Done. Test the live read:"
echo "  URL=\$(gcloud run services describe $SERVICE --project $PROJECT --region $REGION --format='value(status.url)')"
echo "  curl -sX POST \$URL/api/read -H 'content-type: application/json' -d '{\"message\":\"Act now, last chance.\"}'"
