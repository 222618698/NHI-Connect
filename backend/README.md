# NHI-Connect Backend

Spring Boot 3 + PostgreSQL. Setup, configuration, tests and the full API list are in the
[project README](../README.md).

## Quick start
1. Start PostgreSQL: `docker compose up -d` (or use a local PostgreSQL 16 with role/database `nhi`/`nhiconnect`).
2. Start the API: `mvn spring-boot:run` — Flyway creates the schema (V1–V5) and loads the fictional demo data.
3. Run the unit tests: `mvn test`.

## Try it
Every endpoint except sign-in needs a bearer token:
```
curl -X POST http://localhost:8080/security/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"t.moloi","password":"<password>","role":"CLINICIAN"}'
curl -H "Authorization: Bearer <token>" "http://localhost:8080/engine/api/v1/patients/search?idNumber=8801015800083"
```

## Still to build (see the Implementation & Testing report, section 2.2)
- Hospital Adapters (file / database / API ingestion) and FHIR resource validation (HAPI FHIR), tiered profiles
- Probabilistic MPI matching with a low-confidence review queue
- Consent & break-glass, duplicate-test check (Clinical Decision Support), referral summary
- Policy-analyst analytics; SMS account activation
