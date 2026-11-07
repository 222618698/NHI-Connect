# NHI-Connect Backend

Spring Boot 3 + PostgreSQL. Setup, configuration, tests and the full API list are in the
[project README](../README.md).

## Quick start
1. Start PostgreSQL: `docker compose up -d` (or use a local PostgreSQL 16 with role/database `nhi`/`nhiconnect`).
2. Set the demo-account passwords (first start only; see the project README §3):
   `NHI_DEMO_ADMIN_PASSWORD`, `NHI_DEMO_CLINIC_PASSWORD`, `NHI_DEMO_CLINICIAN_PASSWORD`.
3. Start the API: `mvn spring-boot:run` — Flyway creates the schema (V1–V6) and loads the fictional demo data.
4. Run the unit tests: `mvn test`.

## Try it
Every endpoint except sign-in needs a bearer token:
```
curl -X POST http://localhost:8080/security/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"t.moloi","password":"<password>","role":"CLINICIAN"}'
curl -H "Authorization: Bearer <token>" "http://localhost:8080/engine/api/v1/patients/search?idNumber=8801015800083"
```

## Still to build (see the Implementation & Testing report, section 2.2)
- Hospital Adapters (file / database / API ingestion); FHIR ingestion and validation (HAPI FHIR / official validator)
- Probabilistic MPI matching with a low-confidence review queue
- Clinician-level consent restrictions (facility-level consent and break-glass are done)
- Policy-analyst analytics; SMS account activation
