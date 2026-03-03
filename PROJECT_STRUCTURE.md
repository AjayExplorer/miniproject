# College Voting Management System - Project Structure

## Stack
- Frontend: HTML, CSS, JavaScript, Bootstrap 5
- Backend: Node.js + Express
- Database: MongoDB + Mongoose

## Folder Layout
- `server/` → Modular Express app entry (`app.js`, `index.js`)
- `routes/` → Route modules (`auth`, `admin`, `election`, etc.)
- `controllers/` → Request handlers
- `models/` → Mongoose schemas
- `middleware/` → JWT auth and role guard
- `public/` → Frontend pages and shared UI styles

## Run
1. `npm install`
2. `npm start` (existing full-feature server)
3. Optional modular bootstrap: `npm run start:modular`

## Notes
- Existing production flow remains in `server.js`.
- The modular folders (`server`, `routes`, `controllers`) are included to support clean architecture expansion.
- UI now includes dashboard sidebar navigation, status badges, auto redirects, camera preview modal, and toast notifications.
