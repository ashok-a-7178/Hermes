# Hermes team workspace

A full-stack project space for tasks and bugs, project activity, team chat, monthly goals, and natural-language search.

## Stack

- Next.js App Router and TypeScript
- PostgreSQL with Prisma migrations and durable relational records
- Auth.js credentials sessions with bcrypt password hashing
- Tailwind CSS, custom accessible components, Lucide icons, and Framer Motion

## Run locally

1. Install Node.js 20 or newer and PostgreSQL.
2. Copy `.env.example` to `.env`, set `DATABASE_URL`, and generate an auth secret (for example, `openssl rand -base64 32`).
3. Install dependencies and prepare the database:

   ```sh
   npm install
   npx prisma migrate dev
   npm run dev
   ```

4. Open `http://localhost:3000`, create an account, then create a project. Add teammates by the email address they used to register.

Production deployments should set the same environment variables and run `npm run db:deploy` as part of deployment. Keep database credentials and `AUTH_SECRET` out of source control.

## Features

- Project creation and membership; owners/admins can add existing Hermes accounts.
- Tasks and bugs with descriptions, assignment, priority, status, due dates, and activity history.
- Project overview with status/overdue metrics, monthly contributor activity, and recent work.
- Project timeline, persisted project chat, and monthly goals.
- Project-scoped PostgreSQL full-text search across work items, chat, and goals. Search uses PostgreSQL's English text-search parser and ranking; it returns source records, not generated answers.
- Responsive navigation, reduced-motion-aware transitions, and loading, empty, and error states.

## API and access boundaries

All project data endpoints require an authenticated session and verify project membership before reading or changing project data. Only project owners and admins can add members. Task assignees must already belong to the project.

- `GET/POST /api/projects`
- `GET /api/projects/:projectId/summary`
- `GET/POST /api/projects/:projectId/tasks`
- `PATCH /api/projects/:projectId/tasks/:taskId`
- `POST /api/projects/:projectId/members`
- `GET/POST /api/projects/:projectId/chat`
- `GET/POST /api/projects/:projectId/goals`
- `PATCH /api/projects/:projectId/goals/:goalId`
- `GET /api/projects/:projectId/search?q=...`

Chat currently refreshes periodically; its messages are stored in PostgreSQL. Search intentionally starts with native PostgreSQL full-text ranking to avoid an additional vector service before relevance needs are established.
