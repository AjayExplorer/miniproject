🗳️ Voting Management System

A secure digital platform designed to conduct college elections efficiently and transparently.
This system replaces traditional paper-based voting with a structured, role-based, and secure online election system.

📌 Project Overview

The Voting Management System ensures:

Secure authentication using Face Recognition

Role-based administrative control

Duplicate vote prevention

Real-time result generation

Transparent and automated election handling

This system is ideal for college-level elections, including class representatives and union positions.

🏗️ System Architecture
👥 Three-Level Administrative Structure
Role	Responsibilities
Super Admin	Manages entire election system & creates admin accounts
Tutor Admin	Handles class-level elections & student registration
Staff Advisor	Conducts secondary-level union elections
🔐 Key Features
🧠 Face Recognition Authentication

Prevents impersonation

Uses 128-D face embeddings

3 retry attempts allowed

Manual verification fallback

🛑 Duplicate Voting Prevention

Maximum 2 votes per student per election

Backend validation enforced

⚡ Real-Time Result Generation

Instant vote counting

Automatic result display after election ends

🔄 Auto Page Redirection

Admins automatically redirected to voting page when election starts

📝 Manual Verification System

Super Admin approves students if face recognition fails

🛠️ Technology Stack
💻 Frontend

HTML

CSS

JavaScript

Bootstrap 5

⚙️ Backend

Node.js

Express.js

🗄️ Database

MongoDB (Local instance)

MongoDB Compass compatible

🤖 Face Recognition

@vladmandic/face-api

Pure JavaScript (No native build tools required)

📂 Project Setup Guide
1️⃣ Clone the Repository
git clone "https://github.com/AjayExplorer/Miniproject.git"
cd voting-management-system
2️⃣ Install Dependencies
npm install
3️⃣ Configure MongoDB

Make sure MongoDB is running locally:

mongodb://127.0.0.1:27017/voting_system

Update .env file:

MONGODB_URI=mongodb://127.0.0.1:27017/voting_system
PORT=6008
JWT_SECRET=your_secret_key
4️⃣ Download Face Recognition Models

Create folder:

mkdir -p public/models

Download required models from:

👉 https://github.com/vladmandic/face-api/tree/master/model

Required:

ssd_mobilenetv1_model

face_landmark_68_model

face_recognition_model

Place them inside:

public/models/
5️⃣ Start Server
npm start

Server runs at:

http://localhost:6008
6️⃣ Run Smoke Test (Optional)
npm run smoke

Tests:

Login

Fetch students

Fetch candidates

Vote attempt

🔑 Default Login Credentials
Super Admin
Username: superadmin
Password: admin123
🗳️ User Workflow
👑 Super Admin

Login

Create Tutor Admin & Staff Advisor

Start class-level election

Monitor election

Handle manual verification

End class-level election

Start secondary-level election

View final results

📘 Tutor Admin

Register students (Face capture required)

Add candidates

Conduct class election

View results

🎓 Staff Advisor

View elected representatives

Add union candidates

Conduct secondary election

View grouped results

🧪 Voting Process

Student enters admission number

Face verification (3 attempts allowed)

If verified → Select up to 2 candidates

Submit vote

Vote securely stored in MongoDB

🔌 API Endpoints
Authentication

POST /api/login

Admin

POST /api/admin/create

GET /api/admins

Students

POST /api/student/register

POST /api/student/verify-face

GET /api/students/:tutorId

GET /api/students/all

Elections

POST /api/election/start

POST /api/election/end

GET /api/election/status/:type

Candidates

POST /api/candidate/add

GET /api/candidates/:electionId

Voting

POST /api/vote/cast

POST /api/vote/count

GET /api/results/:electionId

Verification

POST /api/verification/request

GET /api/verification/pending

POST /api/verification/resolve

Representatives

GET /api/elected-representatives

🛡️ Security Features

Face recognition authentication

JWT-based admin authentication

Role-based access control

Duplicate vote prevention

Manual verification fallback

Controlled election flow

🗄️ Database Collections

admins

students

elections

candidates

votes

verification_requests

elected_representatives

⚠️ Important Notes

Camera permission is required

Class-level election must end before secondary-level election starts

Only elected representatives can vote in secondary elections

Election status polling every 3–5 seconds

Results automatically calculated after election ends

🎯 Project Type

Mini Project – College Level Voting Automation System

👨‍💻 Developed By

Ajay Krishnan A.P
Malavika C Biju
Ninoy benny
B.Tech Students