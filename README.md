# Team Task & Project Tracker

A beginner-friendly team tracker built with Node.js, Express, PostgreSQL, Bootstrap 5, and browser `fetch()`. Teams have separate workspaces; team members sign in with an account, and a team invite code lets teammates join the same workspace. The browser only talks to the REST API; SQL stays on the server.

## Requirements

- Node.js 18 or newer and npm
- PostgreSQL 12 or newer
- A PostgreSQL database and user for `team_task_tracker`

## Setup and start

1. In this folder, install dependencies:

   ```sh
   npm install
   ```

2. Create a local environment file by copying `.env.example` to `.env`. Set `PGUSER` and `PGPASSWORD` to your PostgreSQL account. `PGHOST` and `PGPORT` default to `localhost` and `5432`; `PGDATABASE` defaults to `team_task_tracker`. Alternatively, set `DATABASE_URL` to your PostgreSQL connection string. Set `PGSSL=true` if your database provider requires SSL.

3. Create the schema and tables:

   ```sh
   npm run db:setup
   ```

   This creates the tables in the PostgreSQL database configured above. It does not import data from an existing MySQL database.

4. Optionally add the sample records to an empty database:

   ```sh
   npm run db:seed
   ```

   Seeding intentionally stops if there are already projects in the database; it will not silently duplicate the sample data. The seed output includes the invite code for its `Demo Team`.

5. Start the server:

   ```sh
   npm start
   ```

   Open [http://localhost:3000](http://localhost:3000), create an account, and choose whether to create a team or join one with its invite code. Share the code shown in the workspace with teammates. Set `PORT` in `.env` to use a different port. While developing, use `npm run dev`.

## PostgreSQL connection troubleshooting on Windows

1. In PowerShell, check whether a PostgreSQL Windows service is installed and running:

   ```powershell
   Get-Service *postgres* | Select-Object Name, Status, StartType
   ```

   If a service is listed as `Stopped`, start it from an elevated PowerShell window using its displayed service name. If no service is listed, install PostgreSQL or use a hosted PostgreSQL service.

2. Check whether a process is listening on TCP port 5432:

   ```powershell
   Get-NetTCPConnection -State Listen -LocalPort 5432 -ErrorAction SilentlyContinue
   Test-NetConnection 127.0.0.1 -Port 5432
   ```

   A listener should appear in the first command and `TcpTestSucceeded` should be `True` in the second. If not, check the PostgreSQL server's configured port and bind address. Set `PGPORT` (and, if needed, `PGHOST`) in `.env` to match.

3. After PostgreSQL is listening and `.env` has the matching connection settings, create the schema, add sample rows, and start the app:

   ```powershell
   npm.cmd run db:setup
   npm.cmd run db:seed
   npm.cmd start
   ```

   The seed script only runs when the projects table is empty. Refresh [http://localhost:3000](http://localhost:3000) after the server starts.

## Deploying to Render

1. Create a Render PostgreSQL database and a Node.js web service connected to this repository. Choose the same region for both.
2. Configure the web service's `DATABASE_URL` environment variable using the database's internal connection URL. Set `NODE_ENV` to `production`.
3. Use `npm ci` as the build command and `npm start` as the start command. Set `/api/health` as the health check path.
4. Run `npm run db:setup` against the hosted database once, then open the Render service's public URL and create a team account.

The app listens on Render's `PORT`. Existing records in the local MySQL database are not automatically copied to PostgreSQL.

## Features

- Dashboard totals for projects, tasks, team members, and task status.
- Create, list, edit, and delete projects, team members, and tasks.
- Task assignment to a project and optional team member, status, priority, and due date.
- Task filters for project, assignee (including unassigned), status, and priority.
- Login, account registration, password hashing, and persistent HTTP-only session cookies.
- Invite-code team registration; projects, tasks, and team members are isolated between workspaces.
- Responsive interface with inline success/error messages and empty states.
- Project deletion cascades to its tasks. Deleting a team member keeps their tasks but clears their assignee.

## REST API

All responses use `{ "data": ... }` on success and `{ "error": { "message": "..." } }` on failure. JSON request bodies are expected. IDs must be positive integers. Invalid input returns 400, missing records return 404, duplicate member email returns 409, and unexpected server errors return 500.

Workspace endpoints require the session cookie set by login or registration. Sessions expire after seven days. Registration accepts `mode: "create"` with a `teamName`, or `mode: "join"` with an `inviteCode`; a newly created account can join one workspace.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Server health |
| POST | `/api/auth/register` | Register and create a team or join with its invite code |
| POST | `/api/auth/login` | Log in and start a session |
| GET | `/api/auth/me` | Get the signed-in user and team invite code |
| POST | `/api/auth/logout` | End the current session |
| GET, POST | `/api/projects` | List or create projects |
| GET, PUT, DELETE | `/api/projects/:id` | Read, update, or delete one project |
| GET, POST | `/api/members` | List or create team members |
| GET, PUT, DELETE | `/api/members/:id` | Read, update, or delete one team member |
| GET, POST | `/api/tasks` | List/filter tasks or create a task |
| GET, PUT, DELETE | `/api/tasks/:id` | Read, update, or delete one task |
| GET | `/api/overview` | Dashboard totals and status counts |

Task list filters can be combined: `project_id`, `member_id`, `status`, and `priority`. Use `member_id=unassigned` for tasks without an assignee. Status values are `To Do`, `In Progress`, and `Done`; priority values are `Low`, `Medium`, and `High`.

Create/update project body:

```json
{ "name": "Website refresh", "description": "Refresh the public site", "start_date": "2026-01-05", "end_date": "2026-03-30" }
```

Create/update member body:

```json
{ "name": "Asha Patel", "email": "asha@example.com", "role": "Designer" }
```

Create/update task body:

```json
{ "title": "Build the task board", "description": "Responsive board view", "project_id": 1, "member_id": 2, "status": "In Progress", "priority": "High", "due_date": "2026-04-20" }
```

Register and join request examples:

```json
{ "name": "Asha Patel", "email": "asha@example.com", "password": "use-a-long-password", "mode": "create", "teamName": "Website team" }
```

```json
{ "name": "Leo Chen", "email": "leo@example.com", "password": "use-a-long-password", "mode": "join", "inviteCode": "A1B2C3D4E5F60718293A4B5C" }
```

`description`, `email`, `role`, `member_id`, and dates may be omitted or empty/null where appropriate. Task `project_id` is required. New tasks default to `To Do` and `Medium`.

## Postman

Import `postman/Team-Task-Project-Tracker.postman_collection.json` in Postman (**Import → Files**). The collection has a `baseUrl` variable defaulting to `http://localhost:3000`, plus requests for each API route and valid/invalid examples. Requests are grouped to create a project/member/task, store their IDs automatically, then exercise list/read/update/delete and validation errors. Run the CRUD folders in order against a running server and configured database.

## Tests

Run the API and validation tests (they use an injected database stub and do not require PostgreSQL):

```sh
npm test
```

## Project structure

```text
database/   PostgreSQL schema
postman/    Importable API collection
public/     Bootstrap page, styles, and browser JavaScript
scripts/    Database setup and sample-data scripts
src/
  middleware/  Shared HTTP error handling
  routes/      REST endpoints for auth, projects, members, tasks, overview
  auth.js      Password hashing and session cookie helpers
  app.js       Express app configuration
  db.js        PostgreSQL connection pool and query adapter
  validation.js Input validation and allowed task values
  server.js    App entry point
test/       Node test-runner API tests
```
