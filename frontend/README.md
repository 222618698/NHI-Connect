# NHI-Connect Frontend — Step 1

React 18 + TypeScript + Tailwind CSS + Vite. Clinician Portal: login → search by SA ID → unified record timeline.

## Run
1. Start the backend first (see ../backend/README.md) — it must be on http://localhost:8080.
2. `npm install`
3. `npm run dev` → open http://localhost:5173

Vite proxies `/engine` and `/security` to the backend, so no CORS setup is needed in development.

## Try it
Sign in with any username, then search `8801015800083` (or click the recent search). Any other 13-digit ID shows "No patient found".

## Structure
- src/pages/       LoginPage, SearchPage, RecordPage
- src/components/  Header, Logo, TimelineItem
- src/api.ts       Calls to the Spring Boot API
- src/auth.tsx     Sign-in state (local only in Step 1; JWT in Step 2)
- src/format.ts    Date formatting + province badge colours
