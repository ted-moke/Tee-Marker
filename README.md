# Tee Marker

Personal golf tee time monitor. Periodically checks Francis Byrne Golf Course (and sister courses Hendricks Field and Weequahic) for available tee times in your configured window and sends a Discord notification when one is found.

## How it works

1. You configure which courses to monitor, which days, and what time window you want
2. The backend scheduler runs on your chosen interval (every 5–60 min)
3. When a tee time appears in your window that hasn't been notified yet, a Discord message is sent
4. You can also manually search for tee times or trigger a check from the dashboard

---

## Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled
- A Firebase service account key (JSON)
- A Foreup account (to log in to Francis Byrne's booking system)
- A Discord server with a webhook URL

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd tee-marker

# Frontend deps
cd frontend && npm install && cd ..

# Backend deps
cd backend && npm install && cd ..
```

### 2. Firebase setup

1. Go to [Firebase Console](https://console.firebase.google.com/) → your project → Firestore → Create database
2. Go to Project Settings → Service Accounts → Generate new private key
3. Download the JSON file and note its path (or copy its contents)

### 3. Backend environment

Create `backend/.env`:

```env
PORT=8080
NODE_ENV=development

# Path to your Firebase service account JSON, OR the raw JSON string
FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/your-service-account.json

# Your Foreup login credentials (the account you use to book at Francis Byrne)
FRANCIS_BYRNE_USERNAME=your@email.com
FRANCIS_BYRNE_PASSWORD=yourpassword
```

### 4. Discord webhook

1. In your Discord server, go to a channel → Edit Channel → Integrations → Webhooks → New Webhook
2. Copy the webhook URL — you'll paste it into the app's Preferences page

---

## Running the app

Open two terminals:

```bash
# Terminal 1 — backend (runs on port 8080)
cd backend && npm run dev

# Terminal 2 — frontend (runs on port 3000)
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## First-time configuration

1. Go to **Preferences** (`/preferences`)
2. Select which courses to monitor (Francis Byrne, Hendricks Field, Weequahic)
3. Pick the days of the week you want to play
4. Set your earliest and latest acceptable tee time
5. Set minimum players available (e.g. 2 means only notify if 2+ spots open)
6. Choose how often to check (every 5, 10, 15, 20, 30, or 60 minutes)
7. Set how many days ahead to look (default: 7)
8. Paste your Discord webhook URL and click **Test** to verify it works
9. Click **Save Preferences**

The scheduler starts automatically when the backend boots and picks up your saved preferences.

---

## Usage

### Dashboard (`/`)
- See whether the scheduler is running, when it last ran, and when it runs next
- View the results of recent checks (times found, notifications sent, any errors)
- Click **Run Now** to trigger an immediate check outside the normal schedule

### Preferences (`/preferences`)
- Update your monitoring configuration at any time
- Changes to the check interval take effect immediately (scheduler restarts)

### Search (`/search`)
- Manually search for tee times on any date without waiting for the scheduler
- Useful for one-off lookups or verifying the Foreup connection is working

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/preferences` | Get current config |
| PUT | `/api/preferences` | Save config |
| POST | `/api/preferences/test-webhook` | Send test Discord message |
| GET | `/api/status` | Scheduler status |
| POST | `/api/scheduler/run` | Trigger an immediate check |
| GET | `/api/history` | Recent check records |
| GET | `/api/tee-times/search` | Search tee times (`?scheduleId=&date=&players=`) |
| GET | `/health` | Health check |

---

## Tech stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Vite
- **Backend**: Node.js, Express, TypeScript, node-cron
- **Database**: Firebase Firestore
- **Notifications**: Discord webhooks
