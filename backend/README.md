# NHI-Connect Backend — Step 1

Spring Boot 3 + PostgreSQL. Covers the core demo flow: search by SA ID number → unified record across facilities.

## Run
1. Start PostgreSQL: `docker compose up -d`
2. Start the API: `./mvnw spring-boot:run` (or `mvn spring-boot:run`)
   Flyway creates the schema and loads fictional demo data on first start.

## Try it
```
curl "http://localhost:8080/engine/api/v1/patients/search?idNumber=8801015800083"
curl "http://localhost:8080/engine/api/v1/patients/22222222-0000-0000-0000-000000000001/record"
```

## Package layout
- domain/      JPA entities (matches the ER diagram)
- repository/  Spring Data repositories
- service/     PatientRecordService — builds the unified timeline
- web/         REST controllers (paths match DDD §5.3)
- db/migration Flyway SQL (V1 schema, V2 demo data)

## Next steps
2. Security: JWT login + roles (Clinician, Nurse, Hospital Admin, System Admin, Policy Analyst) + audit log
3. Hospital Adapter + Interoperability Engine: FHIR submission, validation (HAPI FHIR), terminology mapping
4. MPI matching: weighted scoring + low-confidence review queue
5. Consent & break-glass, duplicate-test check, referral summary
6. Admin Console + Analytics endpoints
