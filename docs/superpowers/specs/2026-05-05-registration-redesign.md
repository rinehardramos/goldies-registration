# Goldies Day 2026 Registration System Redesign

## Overview

Full redesign of the Goldies Day 2026 registration system with a multi-registrant wizard, QR code-based invitations and event-day check-in, JWT authentication, and email delivery via Resend. Branding uses UP gold (#FFD700) and maroon (#800000).

---

## Database Schema

### Modified: `registrations`

```sql
CREATE TABLE registrations (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  batch_year TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  qr_token UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New: `invitations`

```sql
CREATE TABLE invitations (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  invited_by INTEGER REFERENCES registrations(id),
  qr_token UUID UNIQUE DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending',  -- pending | registered
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New: `check_ins`

```sql
CREATE TABLE check_ins (
  id SERIAL PRIMARY KEY,
  registration_id INTEGER REFERENCES registrations(id),
  checked_in_by INTEGER REFERENCES registrations(id),
  checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New: `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New: `settings`

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default seed:
INSERT INTO settings (key, value) VALUES ('event_date', '2026-07-25T10:00:00+08:00');
```

### Existing: `attendees` (unchanged)

Remains as-is for +1 guests under a registrant.

---

## QR Code & Token System

### QR Content

Each QR code encodes a URL: `https://<domain>/qr/<token>` where `<token>` is a UUID.

### Date-Aware Routing — `GET /qr/:token`

The system checks the current date against the admin-configurable event date:

**Before event date:**
- Token in `invitations` + status `pending` → redirect to `/register?token=<token>` (email pre-filled)
- Token in `registrations` → show "Already Registered" page with event details + instructions to show QR at the door

**On event date:**
- Token in `registrations` → show check-in screen (staff auth required to confirm)
- Token in `invitations` + still pending → redirect to registration (late registrant)

### QR Generation

Server-side using `qrcode` npm package. Generates PNG buffer embedded inline in emails (CID attachment).

### Security

- UUIDs provide 122 bits of entropy (unguessable)
- Invitation tokens become inert once registration completes
- Check-in confirmation requires admin JWT
- Rate limiting on `/qr/:token` endpoint

---

## Registration Flow (Multi-Registrant Wizard)

### Step 1 — Who are you registering?

- Radio selection: "Myself" / "Someone else"
- **Myself:** First Name, Last Name, Email, Batch Year (dropdown), Password, Confirm Password
- **Someone else:** First Name, Last Name, Email, Batch Year (dropdown) — no password required

### Step 2 — Review & Add More

- Summary cards of registrant(s) added so far
- "Add another registrant" → loops to Step 1
- "Continue" → proceeds to Step 3

### Step 3 — Invite Others (optional)

- Text area for email addresses (comma or newline separated)
- "Skip" or "Send Invites & Complete"

### Step 4 — Success

- "You're Officially Registered!" screen
- Event date, QR code instructions
- Note about invitations sent (if applicable)

### Backend Logic

- "Myself" → creates `registrations` record with hashed password
- "Someone else" → creates `invitations` record, sends invite email with QR
- Step 3 emails → creates `invitations` records + sends emails
- Registering user receives confirmation email with their permanent QR code

---

## Authentication System (JWT)

### Token Strategy

- **Access token:** 15-minute expiry, stored in React state (memory), sent via `Authorization: Bearer` header
- **Refresh token:** 7-day expiry, stored in HTTP-only secure cookie
- **Logout:** Deletes refresh token from DB + clears cookie

### Endpoints

- `POST /api/auth/register` — create user, return access token + set refresh cookie
- `POST /api/auth/login` — validate credentials, return access token + set refresh cookie
- `POST /api/auth/refresh` — validate refresh cookie, return new access token
- `POST /api/auth/logout` — invalidate refresh token, clear cookie

### Roles

- `user` — profile, manage attendees, send invites
- `admin` — all user permissions + admin panel, check-in, event settings, resend invitations

### Frontend Auth

- Axios interceptor: on 401, attempt silent refresh via `/api/auth/refresh`
- If refresh fails → redirect to login
- `AuthContext` wraps app: provides `user`, `isAuthenticated`, `isAdmin`
- `ProtectedRoute` component for role-based route guarding

---

## Email System (Resend)

### Email Types

1. **Invitation Email** — triggered when admin/user invites someone
   - Subject: "You're Invited to Goldies Day 2026!"
   - Content: event date, QR code image, registration link button

2. **Registration Confirmation Email** — triggered after successful registration
   - Subject: "You're Officially Registered for Goldies Day 2026!"
   - Content: event details, permanent QR code image, instructions to show at the door

3. **Resend Invitation** — same template as #1, triggered by admin on demand

### Template Design

- Gold/maroon UP branding
- Clean layout: header (event name) → body → QR code (centered, large) → footer (event date/location)
- QR code as inline CID-embedded PNG for email client compatibility

### Backend Structure

```
backend/
  services/
    email.js        — Resend client init + send helpers
    qr.js           — QR code generation (returns PNG buffer)
  templates/
    invitation.js   — HTML template for invite emails
    confirmation.js — HTML template for confirmation emails
```

### Admin Controls

- View all sent invitations with status
- Resend button per invitation
- Bulk invite via email list

---

## Admin Panel

### Tabs/Views

1. **Dashboard** — total registered, invitations (pending/registered), checked-in count, quick actions
2. **Registrants** — table with search/filter/inline edit/export to Excel
3. **Invitations** — table with status filter, resend button, bulk invite
4. **Check-in** — QR scanner, search bar, confirmation card, duplicate scan warning, real-time stats, recent check-ins list
5. **Settings** — event date picker (default: July 25, 2026 10:00 AM PHT), event name/location

### Check-in UX (Event Day)

1. Staff logs in on phone/tablet
2. Navigates to Check-in tab
3. Taps "Scan" → device camera opens → scans attendee QR
4. System resolves token → displays confirmation card (name, batch year, green checkmark)
5. Staff taps "Confirm Check-in" → record written to `check_ins`
6. Duplicate scan → "Already checked in at [time]" warning

---

## Frontend Architecture

### Routes

```
/                   → Login page
/register           → Multi-registrant wizard
/register?token=x   → Pre-filled registration (from invitation)
/qr/:token          → Date-aware QR landing
/profile            → User profile + attendees + invite others
/admin              → Admin panel
```

### Component Structure

```
frontend/src/
  components/
    auth/           — LoginForm, RegisterWizard, ProtectedRoute
    ui/             — Button, Input, Card, Modal, Badge, Tabs, Toast
    layout/         — Header, PageContainer
    qr/             — QRLanding, CheckInCard, AlreadyRegistered
  pages/
    LoginPage.jsx
    RegisterPage.jsx
    ProfilePage.jsx
    AdminPage.jsx
    QRPage.jsx
  context/
    AuthContext.jsx
  hooks/
    useAuth.js
    useApi.js       — Axios instance with JWT interceptor
  services/
    api.js          — API endpoint definitions
```

### Visual Design

- **Primary:** UP Maroon (#800000)
- **Accent:** UP Gold (#FFD700)
- **Background:** Subtle warm gradient (cream → light gold)
- **Cards:** White with subtle shadow, maroon accent borders
- **Typography:** Outfit (Google Fonts)
- **Animations:** Framer Motion — page transitions, card entrances
- **Mobile-first** responsive design (check-in will primarily be on phones)

### UX Patterns

- Wizard stepper with progress indicator
- Toast notifications (replace inline messages)
- Loading skeletons
- Confirmation dialogs for destructive actions

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router, Vite, Framer Motion, Axios |
| Backend | Node.js, Express 5, JWT (jsonwebtoken + cookie-parser) |
| Database | PostgreSQL 16 |
| Email | Resend |
| QR Codes | qrcode (npm) |
| Deployment | Render.com (existing infra) |
| Dev | Docker Compose |
