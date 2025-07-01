# Original Project Request

## User Request
I want to make a web application using typescript and react to track tee times at various golf courses. the backend will have the ability to hit apis to request at specificed times (probably using gcloud functions) and then take action maybe book the tee time for me or notify me of opening(s). most courses have different booking platforms and require different routes to be hit along with different response shapes and booking windows (how far in advance can be booked). but the main data we care about is: course, date, time, number of players open in the tee time. 

## Example User Flow
I can go to my app. create an automation which says every N interval, check for tee times at X course(s), between Y and Z times on D days of the week. then there will be background functions that periodically check for those. if my query conditions are met hit this other API to book the time.

**Example**: every hour, check "Francis Byrne" for tee times between 8:45am-11am on M, W, F.

## Technical Requirements
- **Frontend**: TypeScript + React
- **Backend**: Node.js + TypeScript with Google Cloud Functions
- **Database**: Firestore for data persistence
- **Scheduling**: Cloud Scheduler for periodic checks
- **Authentication**: Token management for API access

## Key Features
- Automation creation and management
- Multi-course support with different booking platforms
- Background monitoring and checking
- Automatic booking or notification when conditions are met
- Token refresh handling for API authentication

## Initial Course
- **Francis Byrne**: First course to integrate (minimal token refresh needed)

## Data Focus
Primary data points to track:
- Course name
- Date
- Time
- Number of players available in tee time

## Architecture Notes
- Hardcode APIs and booking windows initially
- System to fetch new tokens when old ones expire
- Modular design to handle different course platforms
- Background functions for periodic checking 