# Luma

A solo rebuild of a language-learning conversation app, originally built with a 7-person team. 
Rebuilt independently to deepen backend fundamentals — raw SQL instead of an ORM, JWT auth instead of Auth0, 
free-tier infra instead of AWS.

## Tech Stack
- Node.js + Express
- PostgreSQL (raw SQL via `pg`, no ORM)
- JWT authentication (bcrypt for password hashing)
- Hosted on Neon (DB) — [deployment platform TBD]

## Status
🚧 In progress

## Features (so far)
- [x] User registration & login (JWT-based auth)
- [x] Auth middleware for protected routes
- [ ] Conversation sessions
- [ ] AI chat integration (Gemini)
- [ ] Grammar correction

## API Endpoints

### Auth
| Method | Endpoint | Description | Auth required |
|--------|----------|-------------|----------------|
| POST | /api/auth/register | Create new user | No |
| POST | /api/auth/login | Login, returns JWT | No |
| GET | /api/auth/me | Get current user | Yes |

## Setup
1. Clone repo
2. `npm install`
3. Copy `.env.example` to `.env` and fill in values
4. Run schema: paste `db/schema.sql` into your Postgres instance
5. `node index.js`

## Why raw SQL instead of an ORM?
Originally built the team version with Prisma. Rebuilding with raw SQL (`pg`) this time 
to understand what an ORM actually abstracts away — connection pooling, query construction, 
parameterized queries for SQL injection prevention, etc.