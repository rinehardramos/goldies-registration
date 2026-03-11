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

## 4. Database Migrations and Seeding
After your first deployment, you will want to seed an administrative user to access the Admin Dashboard.

1. Go to your Render Dashboard and open the **Backend** service.
2. Navigate to the **Shell** tab (on the left menu).
3. In the terminal, run the following command:
   ```bash
   npm run seed
   ```
4. This script connects to the production PostgreSQL database, ensures the `is_admin` column exists, and seeds a user with the email `admin@goldies.com` (password: `Admin123!`).
   *(Tip: You can customize these credentials by adding `ADMIN_EMAIL` and `ADMIN_PASSWORD` to your Environment Variables prior to running).*

## 5. Production URLs
- **Frontend**: Render will provide a unique URL (e.g., `https://goldies2026.onrender.com`).
- **Backend**: Render will provide a unique URL (e.g., `https://goldies-backend.onrender.com`).
- The Static site (Frontend) will automatically point to the Backend service URL via Render's internal service discovery.
