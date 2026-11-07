# BLIMS V2

BLIMS V2 is a school information and learning management system designed for a public elementary school environment. It supports role-based access for administrators, teachers, and students, with modules for attendance, grading, scheduling, announcements, academic records, and user administration.

The project is split into:

- a Node.js/Express backend API
- a static HTML/CSS/JS frontend for different user roles
- MongoDB for persistent data storage

## Overview

BLIMS helps schools manage day-to-day academic operations from a single platform. The application includes typical school workflows such as:

- secure login and password reset flow
- admin management and audit logging
- teacher and student account management
- subject and grade-level configuration
- school year and class schedule management
- attendance tracking
- grade entry and academic record review
- announcements and event updates
- backup scheduling for database protection

## Features

### Admin
- manage teachers, students, subjects, grade levels, and school years
- view dashboard metrics and academic records
- monitor attendance and class schedules
- manage announcements and school events
- maintain audit logs and system-level activity

### Teacher
- manage assigned students and schedules
- record attendance
- handle assessments and grading
- review student progress and promotion data
- publish announcements for classes

### Student
- view personal dashboard
- check attendance, grades, and schedules
- access announcements and class-related updates
- review assigned classwork and academic records

## Tech Stack

- Backend: Node.js, Express
- Database: MongoDB with Mongoose
- Authentication: Express Session, Argon2 password hashing
- Security: CSRF protection, rate limiting, session management
- Email: Nodemailer
- Scheduling: node-cron
- Frontend: HTML, CSS, and vanilla JavaScript

## Project Structure

```text
BLIMS/
├── backend/
│   ├── docs/
│   ├── src/
│   │   ├── backup/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── scripts/
│   │   ├── services/
│   │   ├── utils/
│   │   └── server.js
│   ├── nodemon.json
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── login.html
│   ├── change-password.html
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── js/
│       ├── pages/
│       ├── shared/
│       └── styles/
├── .vscode/
├── README.md
└── .gitignore
```

## Prerequisites

Before running the project, make sure you have:

- Node.js 18+ recommended
- MongoDB running locally or remotely
- a web server such as XAMPP or any local static server for the frontend
- an email account for password reset notifications (optional but recommended)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/estradaronald/BLIMS_V2.git
cd BLIMS_V2/BLIMS
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Create a `.env` file in the `backend` folder.

Example:

```env
SESSION_SECRET=your_session_secret
MONGO_URL=mongodb://localhost:27017/blims
PORT=5000
CLIENT_ORIGIN=http://localhost:80
DB_NAME=school_db
BACKUP_PASSWORD=your_backup_password
EMAIL_USER=your_email@gmail.com
EMAIL_APP_PASSWORD=your_app_password
```

4. Start MongoDB.

5. Run the backend server:

```bash
npm run dev
```

For production-like execution:

```bash
npm start
```

## Running the Frontend

The frontend is a collection of static HTML, CSS, and JavaScript pages. You can run it using:

- a local web server such as XAMPP
- VS Code Live Server
- any static file server that serves the `frontend/` directory

Open the main login page from:

```text
frontend/login.html
```

If the app is being served from a different local path or domain, make sure the backend CORS configuration matches the frontend origin.

## API Behavior

The backend exposes an Express API under `/api` and uses role-aware routes for:

- authentication
- admin features
- teacher features
- student features
- announcements
- attendance
- assessments and grades
- academic records

The main server entry point is:

```text
backend/src/server.js
```

## Scripts

From the `backend` directory:

```bash
npm run dev
npm start
npm run audit:check
npm run audit:fix
```

## Documentation

Additional project documentation is available in the backend docs folder:

- `backend/docs/README.md`
- `backend/docs/api.md`
- `backend/docs/deployment.md`
- `backend/docs/security.md`
- `backend/docs/threat-model.md`
- `backend/docs/troubleshooting.md`

## Notes

This project is actively tailored to a school environment and includes role-specific UI and API flows. Some configuration values such as email credentials, Mongo connection strings, and school-specific settings should be kept in environment variables and should not be committed to version control.

## License

This project currently does not declare a formal license in the repository metadata. Please confirm the licensing requirements with the project owner before publishing or distributing the project beyond internal use.

## Support

For project setup or troubleshooting, review the project docs under `backend/docs` and check the environment variables before starting the application.
