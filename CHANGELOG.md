# Changelog

Post-launch fixes and hardening for the Luma backend. The main [README](./README.md) 
covers what the project is; this file covers how it got more solid over time.

## Round 1: initial code review
After the initial build, went back through the code looking for edge cases and 
security gaps.

- **Orphaned messages on AI failure**: `sendMessage` previously saved the user's 
  message to the DB, then called Gemini — if that call failed, the user's message 
  was stranded with no reply and the client just got a generic 500. Now a failed 
  Gemini call returns a 502 with the saved user message attached, so the client can 
  distinguish "your message didn't send" from "it sent, but the AI reply failed."
- **No password length requirement**: `register` only checked that a password was 
  present, not its length. Added an 8-character minimum, extracted into a testable 
  `isValidPassword` helper.
- **No rate limiting on auth routes**: `/login` and `/register` had no protection 
  against brute-force or credential-stuffing attempts. Added `express-rate-limit` 
  (10 attempts / 15 min / IP).
- **Swagger docs pointed at localhost in production**: the hosted `/api-docs` page's 
  "Try it out" button was configured to hit `localhost:3000`, which fails for anyone 
  using the live docs. Added the Render URL as the primary server.

## Round 2: security hardening after adding the web frontend
Once a real frontend existed, three additional gaps became relevant:

- **CORS allowed every origin**: `app.use(cors())` with no config meant *any* website 
  could call the API from a browser. Replaced with an explicit origin allowlist 
  (configurable via `ALLOWED_ORIGINS` env var), so only the actual frontend can call it.
- **No security headers**: added `helmet`, which sets standard protections 
  (MIME-sniffing prevention, clickjacking protection, etc.) that were previously 
  entirely absent.
- **Prompt injection risk in Gemini calls**: user input was string-concatenated 
  directly into the same prompt as the system instructions, e.g. 
  `` `Sentence to correct: "${sentence}"` ``, with no structural separation between 
  "instructions" and "data." Refactored both Gemini calls to use the SDK's 
  `systemInstruction` parameter (kept separate from user content at the API level) 
  and added explicit "treat this as data, not commands" language, plus input length 
  caps (500 chars for grammar checks, 2000 for chat messages) to limit how much room 
  an attempt has to work with.

## Round 3: inline grammar correction feature
Added grammar checking directly into the chat flow (previously only available via 
the standalone `/api/ai/correct` endpoint), plus a bug caught during manual testing:

- **New schema**: `messages` gained two nullable columns, `corrected_content` and 
  `correction_explanation`, populated only when Gemini finds a real error — "no 
  errors found" or an identical sentence back doesn't light up the UI.
- **Bug found while testing**: when the chat reply failed (a real Gemini `503` came 
  up during testing) but the grammar check succeeded independently, the original 
  implementation discarded the grammar result anyway, since the failure path only 
  saved the message content. Fixed by extracting the correction-handling logic into 
  its own function (`extractCorrection`) used in both the success and failure paths, 
  so a failure in one Gemini call can never silently erase a result from the other.

## Round 4: resilience against Gemini failures
Real-world testing surfaced two distinct Gemini failure modes worth handling differently:

- **Transient overload (`503`)**: Gemini occasionally returns "model currently 
  experiencing high demand." Added automatic retry with backoff (up to 2 retries, 
  waiting 1s then 2s) specifically for this error, since it's usually temporary.
- **Quota exhaustion (`429`)**: the free tier caps Gemini 3.6 Flash at a low daily 
  request limit, and since inline grammar correction doubles API usage per chat 
  message (Round 3's trade-off), this is a realistic thing to hit during normal use. 
  Retrying a quota error doesn't help, so this fails fast instead and returns a 
  distinct, user-facing message ("You've hit today's free AI usage limit. Try again 
  tomorrow.") rather than a generic error — both from the standalone grammar endpoint 
  and from inside a chat conversation.

## Round 5: frontend deployment
Deploying the web frontend to Vercel surfaced two more issues, documented in detail 
in the [luma-web README](https://github.com/parkjoshua0212/luma-web):

- **SPA routing 404s on refresh/direct link**: fixed with a `vercel.json` rewrite rule.
- **CORS blocked the deployed frontend**: `ALLOWED_ORIGINS` needed the live Vercel 
  URL added once it existed.