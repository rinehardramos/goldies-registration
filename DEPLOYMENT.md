# Deployment Guide: Render.com

The GitHub Actions workflow deploys the app through the Render blueprint. The frontend should be available at `https://goldies.space`.

## 1. Secrets Configuration
Go to your GitHub Repository Settings > Secrets and Variables > Actions and add the following secrets:

- `RENDER_API_KEY`: Your Render API key.
- `RENDER_BLUEPRINT_ID`: The ID of your Render blueprint.

## 2. Automatic Deployment

Every push to the `main` branch signals Render to sync the blueprint and redeploy the services.

## 3. Test Admin User

By default, the backend migration seeds:

- Email: `admin@goldies.com`
- Password: `AdminPass123!`

You can override these with backend environment variables `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
