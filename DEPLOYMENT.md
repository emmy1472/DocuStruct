# DocuStruct Live Deployment Guide (Render Hybrid)

This guide walks you through deploying **DocuStruct** live on the web for free with permanent, persistent storage.

## 1. Setup Qdrant Cloud (Free Vector Database)
Since Render's free tier does not support persistent disks (wiping vectors on restarts), we offload vector storage to Qdrant's official managed free tier.

1. Go to [Qdrant Cloud Console](https://cloud.qdrant.io/) and create a free account.
2. Click **Create Cluster** and select the **Free Tier** (1GB storage limit).
3. Under the cluster details page, copy the **Endpoint URL** (e.g., `https://xxxxxx.gcp.qdrant.io:6333`).
4. Click **Data Access Control** -> **Create API Key** and copy the generated key.

---

## 2. Setup Upstash Redis (Free Serverless Broker)
Upstash provides a free serverless Redis cluster that acts as the messaging queue for background processing.

1. Go to [Upstash Console](https://console.upstash.com/) and sign up.
2. Click **Create Database** -> select **Redis**.
3. Choose a name and region close to you, then click **Create**.
4. In the database details, scroll to the **Node.js / Python / Go** connection options, find the **Redis URL** tab, and copy the connection string:
   `redis://default:password@your-upstash-endpoint.upstash.io:6379`

---

## 3. Deploy to Render using the Blueprint
1. Go to [Render Dashboard](https://dashboard.render.com/) and log in.
2. Click the **New** button (top right) and select **Blueprint**.
3. Connect your GitHub repository (`DocuStruct`).
4. Fill in the deployment details:
   - **Service Group Name**: `docustruct-group`
   - **Branch**: `development`
5. Render will automatically read the `render.yaml` file and prompt you for the following environment variables:
   - `QDRANT_URL`: Paste your Qdrant cluster endpoint.
   - `QDRANT_API_KEY`: Paste your Qdrant API key.
   - `REDIS_URL`: Paste your Upstash Redis connection string.
   - `GEMINI_API_KEY`: Paste your Google AI Studio API key.
6. Click **Apply**.

Render will provision your PostgreSQL instance and build/deploy your FastAPI container automatically. Once finished, it will provide a public URL (e.g., `https://docustruct-api.onrender.com`) where your API and Swagger docs (`/docs`) are live!
