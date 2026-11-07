# NHI-Connect — Interoperable EHR Gateway

Capstone implementation of NHI-Connect: a gateway that lets South African public hospitals and clinics share one
patient record, found by the patient's SA ID number.

| Part | Stack | Folder |
|---|---|---|
| Backend (Interoperability Engine, MPI, Security Layer, audit) | Java 17, Spring Boot 3.3, PostgreSQL 16, Flyway | `backend/` |
| Frontend (Clinician Portal, Clinic portal, Admin Console) | React 18, TypeScript 5, Vite 5, Tailwind CSS 3 | `frontend/` |
| Integration and performance tests | Python 3 (standard library only) | `tests/` |

## 1. Prerequisites

* JDK 17 (tested with Eclipse Temurin 17.0.21) and Maven 3.9+
* Node.js 20+ and npm (tested with Node 24.19)
* PostgreSQL 16 — either installed locally or via Docker (`backend/docker-compose.yml`)
* Python 3.10+ (only to run the tests in `tests/`)

> Keep the project in a folder whose path has **no `#` character**: Vite cannot serve files from such a path
> (the page stays blank; see defect DEF-001).

## 2. Database

With Docker: `cd backend && docker compose up -d`.

Without Docker, as a PostgreSQL superuser:

```sql
CREATE ROLE nhi LOGIN PASSWORD 'nhi_dev_password';
CREATE DATABASE nhiconnect OWNER nhi;
```

Flyway creates every table and loads the fictional demo dataset (6 patients, 6 facilities) on first start.

## 3. Run

```bash
# terminal 1 — API on http://localhost:8080
cd backend
mvn spring-boot:run

# terminal 2 — web app on http://localhost:5173
cd frontend
npm install
npm run dev
```

On first start with an empty user table the backend creates four demo accounts
(`admin`, `braamfontein.clinic`, `t.moloi`, `a.khumalo`). Their passwords are set in
`backend/src/main/java/za/nhiconnect/auth/DemoUserSeeder.java`; **change them** (Admin Console → Clinics & Users →
Reset password) before the system holds any real data.

Sign-in: choose **Clinician / Nurse** for clinician, nurse and clinic-staff accounts, or **Administrator** for admins.
The account decides which portal opens.

## 4. Configuration

| Setting | Where | Default |
|---|---|---|
| Database URL / user / password | `spring.datasource.*` in `backend/src/main/resources/application.yml` | `localhost:5432/nhiconnect`, `nhi` |
| Allowed browser origins (comma-separated) | `nhi.cors.allowed-origin` | `http://localhost:5173` |
| Session lifetime (hours) | `nhi.auth.session-hours` | `8` |
| Max upload size | `spring.servlet.multipart.max-file-size` | `10MB` |
| Backend URL used by the dev server | environment variable `NHI_API` | `http://localhost:8080` |

Any property can be overridden on the command line, e.g.
`mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=8081"`.

## 5. Tests

```bash
cd backend && mvn test                                   # 43 unit tests (JUnit 5)
python tests/api_integration_test.py http://localhost:8080   # 39 API integration tests
python tests/performance_test.py http://localhost:8080       # latency / throughput measurement
```

The integration tests create patients, accounts and audit events, so run them against a **fresh or test database**,
never one holding real data. A separate schema works well:

```bash
psql -U nhi -d nhiconnect -c "CREATE SCHEMA nhitest AUTHORIZATION nhi;"
mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=8081 \
  --spring.datasource.url=jdbc:postgresql://localhost:5432/nhiconnect?currentSchema=nhitest \
  --spring.flyway.schemas=nhitest --spring.flyway.default-schema=nhitest \
  --spring.jpa.properties.hibernate.default_schema=nhitest"
python tests/api_integration_test.py http://localhost:8081
```

## 6. API overview

All endpoints except sign-in need `Authorization: Bearer <token>` from the sign-in response.

| Method & path | Who | Purpose |
|---|---|---|
| `POST /security/api/v1/auth/login` | anyone | Sign in (`username`, `password`, `role` = "Sign in as" choice) |
| `GET /security/api/v1/auth/me`, `POST …/logout` | signed in | Current user; end session |
| `GET /engine/api/v1/patients/search?idNumber=` | clinician, clinic | Find patient by SA ID (MPI) |
| `GET /engine/api/v1/patients/{id}/record` | clinician, clinic | Unified cross-facility timeline |
| `POST /engine/api/v1/patients/{id}/entries` | clinician, clinic | Add visit / lab result / medication |
| `GET, POST /engine/api/v1/patients/{id}/documents`, `GET /engine/api/v1/documents/{id}` | clinician, clinic | Patient documents |
| `POST /engine/api/v1/decision-support/check-duplicate` | clinician, clinic | Duplicate-test warning (REQ-004) |
| `GET /engine/api/v1/patients/{id}/referral-summary` | clinician, clinic | Referral summary PDF (REQ-009) |
| `GET /engine/api/v1/fhir/Patient/{id}/$everything?profile=full\|lite` | clinician, clinic | FHIR R4 Bundle export (REQ-005) |
| `POST /engine/api/v1/patients/{id}/break-glass` | clinician | Emergency access to a consent-restricted record (REQ-006) |
| `GET, POST /engine/api/v1/clinic/patients/{id}/consent`, `DELETE …/consent/{rid}` | clinic | Record / lift a patient's consent restriction |
| `GET /engine/api/v1/admin/break-glass`, `POST …/break-glass/{id}/review` | admin | Review break-glass events |
| `GET /engine/api/v1/clinic/overview`, `/clinic/patients`, `/clinic/updates` | clinic | Clinic dashboard, patients, updates to review |
| `POST /engine/api/v1/clinic/patients`, `/clinic/updates/{id}/review` | clinic | Manual intake; mark update reviewed |
| `GET /engine/api/v1/admin/overview`, `/admin/audit`, `/admin/updates` | admin | Who is signed in, audit log, updates |
| `GET, POST /engine/api/v1/admin/facilities`, `/admin/users`; `PATCH /admin/users/{id}`; `POST /admin/users/{id}/password` | admin | Clinics and accounts |

## 7. Code layout

```
backend/src/main/java/za/nhiconnect/
  auth/        Security Layer: sign-in, sessions, request interceptor, role checks, audit trail
  config/      CORS + interceptor registration
  domain/      JPA entities (Patient, HospitalFacility, Encounter, Observation, Medication)
  repository/  Spring Data repositories (read side)
  service/     PatientRecordService (unified timeline), RecordEntryService (manual intake, documents, review),
               ConsentService (consent & break-glass), DecisionSupportService (duplicate-test check),
               ReferralSummaryService (PDF), FhirExportService (FHIR R4, full/lite)
  util/        SaIdNumber, FileNames, TestEquivalence (pure, unit-tested helpers)
  web/         REST controllers + ApiExceptionHandler
backend/src/main/resources/db/migration/   Flyway V1–V6
frontend/src/
  pages/       Clinician Portal (login, search, record)
  clinic/      Clinic portal (overview, patients, patient page)
  admin/       Admin Console (overview, clinics & users, audit log; onboarding/mapping are demo pages)
  components/  Shared UI (layout, forms, tables, documents)
tests/         API integration + performance tests
```
