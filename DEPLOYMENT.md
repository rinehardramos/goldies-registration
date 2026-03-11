# Deployment Guide: Render.com

To successfully deploy the Goldies Day 2026 Registration app, follow these steps:

## 1. Secrets Configuration
Go to your GitHub Repository Settings > Secrets and Variables > Actions and add the following secrets:

- `RENDER_API_KEY`: Your Render API key (found in Account Settings > API Keys).
- `RENDER_BLUEPRINT_ID`: The ID of your Blueprint after you first create it on Render.

## 2. Initial Setup on Render
1. Connect your GitHub repository to Render.
2. Go to **Blueprints** and click **New Blueprint Instance**.
3. Select your repository.
4. Render will parse the `render.yaml` file and prompt you to create the services.
5. Once created, copy the **Blueprint ID** and add it to your GitHub Secrets.

## 3. Automatic Deployment
Every push to the `main` branch will now trigger the GitHub Action, which will signal Render to redeploy your services based on the Blueprint.

## 4. Production URLs
- **Frontend**: Render will provide a unique URL (e.g., `https://goldies-frontend.onrender.com`).
- **Backend**: Render will provide a unique URL (e.g., `https://goldies-backend.onrender.com`).
- The Static site (Frontend) will automatically point to the Backend service URL via Render's internal service discovery.
