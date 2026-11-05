# Product spec: requirements, entities, delivery phases

> Moved out of CLAUDE.md. Describes the intended product, not what is implemented. Source brief: `../about_project.md` (Russian). Inspect the repository before claiming any feature exists.

## 5. MVP functional requirements

### 5.1 Identity and user profiles — MUST
- Email/password authentication, email verification when required, secure password-reset flow, session/token management, throttling, account blocking/recovery.
- Parent profile; minimal child-related record consisting only of justified fields, e.g. age band and relevant education-support preferences. **No public identifiable child profile**.
- Specialist biography, experience, specializations, location and online/offline service format, qualification uploads and verification state.
- School/NGO profile, contact person and legal/business details appropriate for the market; basic vacancies if approved for first release.
- OAuth (Google) and SMS login are SHOULD, not prerequisites for MVP.

### 5.2 Learning management system — MUST
- Public course catalog and SEO-friendly course pages; filter by category, level, and price when pricing is enabled.
- Courses → modules → lessons → assignments/quizzes; configurable publication states.
- Lesson formats: streaming video, rich text, PDF; track meaningful completion and progress.
- Module quizzes with server-side scoring and attempt policy; avoid exposing answer keys in advance.
- Define a clear distinction between **course completion** and **professional verification**.
- Course payments are SHOULD; do not implement checkout or payment storage before gateway, market, invoicing, refunds and reconciliation rules are approved.

### 5.3 Specialist directory — MUST
- Public professional cards: name, photo (subject to consent), specialization, experience, region/format, stated service price, rating when eligible, verification indicator.
- Search/filter by specialization, region, online/offline, price, certificate/verification status.
- Contact through a request form; real-time chat is an **alternative**, not automatically required. Prefer requests for initial MVP if not otherwise approved.
- Reviews: only verified client interactions; eligibility derived from a validated engagement, not merely login or course completion. Moderation, anti-spam, abuse reporting and appeal path.
- Never expose contact details, child details, or uploaded documents publicly without explicit permission and legal basis.

### 5.4 Course certificates and specialist verification — MUST
- Issue PDF course completion certificates only after documented completion criteria are met.
- Use unique unpredictable certificate identifiers and QR links to `/verify/{id}`.
- Public verification should return **only approved minimal fields** (e.g. certificate status, course title, issue date, and optionally credential holder's display name with appropriate notice/consent); never reveal private documents, child data or internal IDs.
- Certificate revocation and reissuance/status handling are required to make verification trustworthy.
- Keep certificate issuance idempotent and auditable; do not equate a course certificate with government accreditation or an independently verified professional diploma.
- Manual qualification verification: private upload, queue, approved/rejected/needs-info statuses, moderator rationale, verified badge subject to validity and revocation.
- Uploaded files require type/size limits, content inspection/malware scanning as feasible, restricted access, retention rules and safe metadata handling.

### 5.5 Admin and moderation — MUST
- Manage courses, modules, lessons, quizzes, publication and content ordering.
- Review qualification evidence, complaints, reviews, and reported content.
- Manage users, permissions, suspensions and verification decisions.
- Audit sensitive administrative actions; basic operational metrics without unnecessary personal data.

### 5.6 B2B — scope boundary
- School/NGO identity/profile and base organization role are part of the described product.
- Vacancy posting and corporate training are product requirements, but their **MVP release priority, billing model and acceptance criteria must be confirmed** before implementation. Do not assume a full multi-tenant learning suite in the first release.

## 6. Nonfunctional acceptance criteria

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

## 7. Suggested core entities (adapt to repo, not an automatic migration plan)

- `User`, `Role`, `Permission`, `UserRole`, `Session/Token`, `AuditEvent`.
- `ParentProfile`, `ChildSupportProfile` (private/minimized), `SpecialistProfile`, `Specialization`, `Organization`, `OrganizationMember`, `Vacancy`.
- `Course`, `CourseModule`, `Lesson`, `LessonAsset`, `Enrollment`, `LessonProgress`, `Assignment`, `Quiz`, `Question`, `AnswerOption`, `QuizAttempt`, `AttemptAnswer`.
- `SpecialistRequest` / `Conversation` (choose approved interaction model), `Review`, `Report`.
- `QualificationDocument`, `VerificationCase`, `VerificationDecision`, `Certificate`, `CertificateRevocation`.
- `Payment`, `Order`, `GatewayEvent` **only after payments are approved**.

Use explicit ownership/tenancy, privacy visibility and lifecycle status fields. Distinguish an internal primary key from public-safe identifiers. Never expose raw object storage keys as public document URLs.

## 9. MVP delivery approach (planning guide, not a guaranteed schedule)

**Phase 0 — Discovery and foundations:** validate personas and user journeys, choose stack/hosting jurisdiction, design permissions and privacy model, initial UX/accessibility, CI, environments, threat model and test strategy.

**Phase 1 — Identity, profiles and administration:** registration, role-specific profiles, access control, secure uploads, basic moderation and CMS skeleton.

**Phase 2 — LMS:** catalog, course structure, content playback, enrollments/progress, quizzes, authoring workflows.

**Phase 3 — Directory, verification and certificates:** specialist search, inquiry requests, manual qualification review, issuance and public verification of course certificates, review eligibility.

**Phase 4 — Hardening and launch:** permissions/security tests, accessibility audit, privacy/data residency checks, load tests, monitoring, backups, staging acceptance, release checklist.

B2B enhancements, advanced chat, OAuth, SMS and payments enter the MVP only via explicit priority decision and revised scope. Prioritize demonstrable end-to-end user journeys over expanding feature count.
