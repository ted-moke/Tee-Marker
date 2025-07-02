#!/bin/bash

# Tee Marker Backend Deployment Script

set -e

echo "🚀 Starting Tee Marker Backend Deployment..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with Google Cloud. Please run 'gcloud auth login' first."
    exit 1
fi

# Get project ID from environment or prompt user
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-""}
if [ -z "$PROJECT_ID" ]; then
    echo "Enter your Google Cloud Project ID:"
    read PROJECT_ID
fi

# Set the project
echo "📋 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable pubsub.googleapis.com

# Build the backend
echo "🏗️ Building backend..."
npm run build

# Deploy Cloud Functions
echo "☁️ Deploying Cloud Functions..."
gcloud functions deploy checkTeeTimes \
    --runtime nodejs18 \
    --trigger-topic tee-time-checks \
    --source functions \
    --entry-point checkTeeTimes \
    --region us-central1 \
    --allow-unauthenticated

# Create Pub/Sub topic if it doesn't exist
echo "📡 Creating Pub/Sub topic..."
gcloud pubsub topics create tee-time-checks || echo "Topic already exists"

# Deploy to Cloud Run (for the API server)
echo "🚀 Deploying API server to Cloud Run..."
gcloud run deploy tee-marker-api \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
    --set-env-vars "NODE_ENV=production"

# Get the Cloud Run URL
API_URL=$(gcloud run services describe tee-marker-api --region us-central1 --format="value(status.url)")

echo "✅ Deployment completed successfully!"
echo "🌐 API URL: $API_URL"
echo "📊 Cloud Functions deployed to: us-central1"
echo ""
echo "Next steps:"
echo "1. Update your frontend environment variables with the API URL"
echo "2. Set up Firebase Authentication"
echo "3. Configure your service account keys"
echo "4. Test the API endpoints" 