# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Inclusive Education Ecosystem

> Read this file before planning, editing, running commands, or proposing architecture. Requirements describe the intended product, not proof that a feature has already been implemented. **Inspect the repository before making implementation claims.**

## 0. Repository state, commands, and documents

**Current state:** `web/` holds a Next.js 16 (App Router, TypeScript, npm) frontend scaffold, intended for Vercel. Backend stack is not chosen yet (needs an ADR; keep personal/child data off Vercel pending legal review). CI lives in `.github/workflows/ci.yml`; setup steps are in `docs/ci-cd-setup.md`.

**Commands (run inside `web/`):**
- `npm ci` — install; `npm run dev` — dev server; `npm run build` — production build
- `npm run lint`, `npm run typecheck` — checks; `npm test --if-present` — no test runner configured yet
- `npm audit --audit-level=high` — dependency check used in CI

**Documents:**
- `about_project.md` — original brief (technical assignment), in Russian. Source of product intent.
- `docs/product-spec.md` — detailed MVP requirements (identity, LMS, directory, certificates, admin, B2B), suggested core entities, and delivery phases. Read the relevant part before implementing a feature.
- `docs/adr/` — architecture decision records (create when the first decision is approved).

**Language:** reply to the user in Russian unless asked otherwise; code, identifiers, commits, and docs/ADRs stay in English. User-facing UI strings go through translation keys (`ru` first, `uz` prepared).

## 1. Product mission and scope

Build an accessible, secure educational ecosystem for inclusive education in the CIS market, combining:
1. Online courses for parents, specialists, and organizations.
2. Discovery and contact with vetted educators, tutors, and other relevant specialists.
3. Training outcomes and verifiable course certificates.
4. Manual verification of professionals' qualifications.
5. Moderation and administration, including B2B functionality for schools and NGOs.

**MVP target:** approximately 4–6 months. **Initial locale:** Russian (`ru`), architecture ready for Uzbek (`uz`) and other CIS locales; do not hardcode UI strings. **Primary platforms:** responsive web, mobile-first. **Accessibility goal:** WCAG 2.1 AA, including usable screen readers and keyboard navigation. Voice assistance may be added where it gives real value; it is not a substitute for semantic accessibility.

Optimize for a maintainable MVP, not speculative enterprise infrastructure. Do not silently expand scope or treat suggested technology as a confirmed decision.

## 2. Required workflow for every task

1. **Discover:** Read the relevant files, `README`, configurations, migrations, tests, and adjacent modules. Locate existing implementations and reuse them. Do not assume this is a new/empty repo.
2. **Clarify decisions:** Identify requirements, acceptance criteria, dependencies, and gaps. If a choice affects architecture, security, cost, deployment, legal compliance, or the MVP scope, present options and obtain approval before proceeding.
3. **Plan:** For work that touches multiple modules, data models, auth, payments, personal data, certificates, or migrations, propose a short implementation plan, affected files, risks, test plan, and rollback approach **before editing**. For small, unambiguous changes, implement directly.
4. **Implement:** Keep changes small, cohesive, backwards-compatible and consistent with existing conventions. Prefer working end-to-end increments instead of unrelated refactors.
5. **Verify:** Run available type checks, lint, focused tests, and integration checks. Explicitly state what ran and what could not run. Never claim success without executing checks.
6. **Report:** Summarize behavior, files changed, schema/API changes, security/accessibility implications, tests, and remaining risks.

Do not rewrite an existing working module merely to match a preferred technology. Do not add dependencies, change public contracts, generate destructive migrations, modify deployment infrastructure, or launch paid services without explicit approval. Do not run `git push`, deploy, delete important data, or apply production migrations without permission. Preserve unrelated local changes; do not use destructive Git commands to clean up the workspace.

## 3. Technology and architecture decisions

The specification lists **alternatives**, not final choices:
- Frontend: React or Next.js; **Next.js is a candidate** because public course and specialist catalogs benefit from server rendering/SEO.
- Backend: NestJS, FastAPI, or Django/DRF; **choose based on existing repository and team expertise**, not personal preference.
- Data: PostgreSQL; object storage compatible with S3 for documents and certificate artifacts.
- Video: managed video streaming/CDN provider such as Bunny.net, Cloudflare Stream, or Vimeo; avoid hosting large video files directly through the application server.
- Deployment: Docker and appropriate cloud or legally compliant local hosting; Kubernetes is **not required for MVP** absent a demonstrable operational need.
- Monitoring: Sentry or an equivalent error tracker, configured not to capture sensitive child/medical data.

**Decision gate:** First inspect the repository and document the actual stack. If the repository does not establish one, create a short ADR comparing at least two realistic options (team proficiency, speed to MVP, SSR, CMS, permissions, operations, cost) and ask for a decision **before scaffolding**. Never run two backend frameworks in parallel without a clear approved reason.

Default architectural principles, regardless of stack:
- Modular monolith for MVP unless real requirements justify microservices.
- Separate domains: `identity`, `profiles`, `organizations`, `courses`, `learning`, `assessments`, `specialist_directory`, `requests_or_messaging`, `reviews`, `credentials`, `verification`, `moderation`, `billing` (optional), `audit`.
- API versioning and explicit request/response schemas; consistent errors and pagination.
- Database constraints, transactions for multi-step state transitions, migrations reviewed and reversible where possible.
- Background jobs for PDF generation, email, video-provider webhooks, and other slow operations.
- Store sensitive files in **private** buckets, issue short-lived authorized access URLs, and keep uploads off public web roots.
- Avoid premature complexity. Document trade-offs in `docs/adr/` if approved.

## 4. Personas and authorization (RBAC)

Implement access checks **on the server for every sensitive read and mutation**; hiding UI elements is not authorization. Design for users potentially having more than one role when explicitly approved. Default least privilege and deny by default.

| Role | Core capabilities | Important limits |
|---|---|---|
| Parent / Family | Manage own profile, optional anonymized child profile, enroll in courses, discover specialists, send requests, submit eligible reviews | Access only own family/child data and own communications |
| Specialist / Tutor / Educator | Manage own profile, upload qualification documents, take courses, receive and manage own requests | Cannot self-approve verification, awards, or ratings |
| School / NGO | Organization profile, authorized staff, vacancies; corporate learning if in approved scope | Tenant isolation: access only own organization resources |
| Moderator / Verifier | Review documents, profiles, reports, content; approve/reject with reason | Restricted views of sensitive data; cannot assign own elevated permissions |
| Administrator | Manage roles, users, courses, moderation, CMS, analytics | Privileged actions logged; sensitive data access still minimized |

Define a permission matrix covering resource, action, role, ownership, status, and organization scope **before implementing auth**. Add tests for vertical/horizontal privilege escalation and organization isolation. Use explicit state machines for `pending / approved / rejected / suspended` workflows where applicable. Log actor, timestamp, entity, previous/new state, and reason for high-risk administrative actions. Do not expose document contents or child records in general audit logs.


## 5. Nonfunctional acceptance criteria

### Accessibility
- Target **WCAG 2.1 AA**, checked manually and with automated tooling; automated scans alone cannot prove conformance.
- Semantic HTML, correct headings and labels, visible keyboard focus, logical tab order, skip links, appropriate accessible names and error descriptions.
- Text contrast at least 4.5:1 for normal text and 3:1 for large text (subject to WCAG exceptions), scalable typography, reflow and zoom without lost functionality.
- Accessible dialogs, forms, tables, filtering, media controls and quiz interactions; test with a screen reader and keyboard.
- Captions/transcripts for prerecorded video as applicable, accessible alternative to documents when PDFs are unusable, and no audio-only critical feedback.
- Optional narrated guidance must be user-controlled (on/off, repeat, pause), avoid unexpected autoplay, and must not replace screen-reader support.

### Security and privacy
- **Child and disability-related information is highly sensitive. Minimize collection.** Specify a lawful basis, guardian consent where needed, access controls, data retention, deletion and breach procedures before release.
- The specification mentions Russian 152-FZ and CIS privacy laws, but applicability and local data residency **must be reviewed for each actual launch jurisdiction**. Do not claim compliance or assume one common CIS legal regime. Select hosting/data-transfer arrangements only after legal assessment.
- TLS in transit, encryption at rest for sensitive storage, managed secrets, least-privilege service accounts, secure backups and restoration tests.
- Use strong password hashing, secure cookies/token handling, CSRF protection as relevant, validation, output encoding, upload restrictions, rate limits, and OWASP-aligned safeguards.
- Prevent IDOR/BOLA: all object access requires ownership, permission or approved public visibility.
- Do not print secrets, certificates' underlying source files, tokens, child information or qualification scans to logs or error monitoring. Use synthetic/anonymized fixtures in tests.
- Do not place production `.env` or credentials into source control or AI prompts. Follow a deliberate incident-response and deletion/retention process.

### Performance, delivery and UX
- Mobile-first, responsive across common screen sizes and assistive technologies.
- Target user-perceived page loading of **≤3 seconds** under an explicitly defined test profile (network, device, geography, representative page and percentile); measure rather than promise universal speed.
- CDN-based video delivery with adaptive playback from a selected provider; measure startup and buffering rather than assuming zero delay.
- Paginate searchable catalogs and admin lists; appropriate indexes, avoid N+1 queries, use caching only after profiling.
- Produce observable metrics (latency, error rates, job failures, relevant business funnel) without collecting unnecessary personal data.

## 6. API, frontend and quality standards

- Keep public SEO pages separate from authenticated dashboards and admin screens as appropriate for the chosen framework.
- Validate input and enforce permissions server-side. Return consistent machine-readable errors and localized human-readable messages.
- Prefer typed schemas, shared constants for status values, structured service boundaries and documented API contracts.
- Implement loading/empty/error/success states and accessible validation messaging for each critical flow.
- Use translation keys from the beginning (`ru` initially, `uz` prepared), including date/number formatting; no hardcoded visible strings scattered through components.
- Tests must cover: authentication and password resets, unauthorized access, ownership/tenant isolation, enrollment and scoring rules, duplicate certificate issuance, public verification/revocation, moderation transitions, and reviews' verified-client eligibility.
- Add accessibility checks to UI testing and verify critical paths manually. Add integration tests for provider callbacks and idempotency if third-party integrations exist.
- Format/lint/type-check according to repository tooling. Avoid installing new tooling without checking existing scripts.

## 7. Definition of Done

A feature is complete only when:
1. Its behavior matches agreed acceptance criteria and role/ownership rules.
2. Relevant API and UI flows work end to end, including negative and empty states.
3. Schema changes are reviewed, safe, and migration instructions exist.
4. Focused tests and existing relevant checks pass, or failures/limitations are recorded accurately.
5. Privacy/security risks, accessible interaction, localization and mobile layout have been considered and checked as relevant.
6. No unintended public data exposure, new secrets, breaking API changes or unrelated refactors are introduced.
7. User-facing behavior and important design decisions are documented.

## 8. First-session instructions for Claude Code

**Before writing code:**
1. Inspect the repository and report what actually exists vs what this document requires.
2. Identify the current stack, folder organization, implemented modules, routes, entities, migrations, test scripts and deployment configuration.
3. Create a **gap analysis** grouped as `MUST / SHOULD / Later` with dependencies, risks and estimated relative effort. Do not assert that an entity exists until its source is found.
4. Propose a permission matrix, domain/module map, MVP sequence and architecture decision list.
5. Highlight unresolved decisions: backend/frontend stack, launch country and legal/data-residency regime, hosting, video provider, payment inclusion, chat vs request form, organization tenancy and verification disclosure policy.
6. **Stop after the report; do not edit code or create infrastructure until the user approves a concrete task and plan.**

**Empty-repo shortcut:** if section 0 still says no code exists, skip the gap analysis and go straight to a stack ADR (at least two realistic options) plus the open-decisions list, then wait for approval.

When working on future tasks, follow the workflow in section 2 and use this file as persistent context. If a user request conflicts with these defaults, surface the conflict and follow the user's explicit approved decision, while preserving security and applicable law.
