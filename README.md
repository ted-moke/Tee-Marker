# Tee Marker - Golf Tee Time Tracker

A web application built with TypeScript and React to automate golf tee time tracking and booking across multiple golf courses with different booking platforms.

## Features

- **Automation Creation**: Create automated checks for specific courses, time ranges, and days
- **Background Monitoring**: Cloud functions periodically check for available tee times
- **Smart Booking**: Automatic booking when conditions are met
- **Multi-Platform Support**: Handle different golf course booking APIs and response formats
- **Token Management**: Handle API authentication and token refresh

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Redux Toolkit** for state management
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **Lucide React** for icons

### Backend
- **Node.js** with TypeScript
- **Express.js** for API server
- **Firebase Admin** for database and authentication
- **Google Cloud Functions** for background jobs
- **Axios** for HTTP requests

### Infrastructure
- **Google Cloud Platform**
- **Firestore** for database
- **Cloud Functions** for serverless computing
- **Cloud Scheduler** for cron jobs

## Project Structure

```
tee-marker/
├── src/                    # Frontend source code
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── store/             # Redux store and slices
│   └── types/             # TypeScript type definitions
├── backend/               # Backend API server
│   ├── src/
│   │   ├── controllers/   # API route handlers
│   │   ├── models/        # Data models
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utility functions
│   └── functions/         # Google Cloud Functions
├── docs/                  # Documentation
└── scripts/               # Build and deployment scripts
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Cloud Platform account
- Firebase project

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables:
```env
PORT=8080
NODE_ENV=development
GOOGLE_CLOUD_PROJECT=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=path/to/service-account.json
JWT_SECRET=your-jwt-secret
```

5. Start development server:
```bash
npm run dev
```

### Google Cloud Setup

1. Create a new Google Cloud project
2. Enable required APIs:
   - Cloud Functions API
   - Cloud Scheduler API
   - Firestore API
   - Cloud Build API

3. Set up Firebase:
   - Create Firestore database
   - Generate service account key
   - Configure security rules

4. Deploy Cloud Functions:
```bash
gcloud functions deploy checkTeeTimes --runtime nodejs18 --trigger-topic tee-time-checks
```

## Development

### Adding a New Golf Course

1. Create a new course adapter in `backend/src/adapters/`
2. Implement the required interface methods
3. Add course configuration to the database
4. Update the frontend course management interface

### Creating Automations

1. Use the automation builder in the frontend
2. Configure course selection, time ranges, and check intervals
3. Set booking preferences (notify or auto-book)
4. The system will automatically schedule background checks

## API Endpoints

### Automations
- `GET /api/automations` - List user automations
- `POST /api/automations` - Create new automation
- `PUT /api/automations/:id` - Update automation
- `DELETE /api/automations/:id` - Delete automation

### Courses
- `GET /api/courses` - List configured courses
- `POST /api/courses` - Add new course
- `PUT /api/courses/:id` - Update course configuration
- `DELETE /api/courses/:id` - Remove course

### Tee Times
- `GET /api/tee-times` - Search for available tee times
- `POST /api/tee-times/book` - Book a tee time

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please open an issue on GitHub or contact the development team. 