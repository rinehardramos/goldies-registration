# Deployment Guide: Railway

Railway is the deployment target for `https://goldies.space`. Railway deploys from GitHub when changes are pushed to `main`.

## 1. GitHub Actions

The GitHub Actions workflow validates the deploy source by building the frontend and checking backend syntax. It does not call Render or Cloudflare.

## 2. Automatic Deployment

Every push to the `main` branch should trigger Railway's connected GitHub deployment for the services behind `https://goldies.space`.

## 3. Test Admin User

By default, the backend migration seeds:

- Email: `admin@goldies.com`
- Password: `AdminPass123!`

You can override these with backend environment variables `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
