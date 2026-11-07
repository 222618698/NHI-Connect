-- Real accounts, sign-in sessions, a persistent audit trail and per-patient documents.

CREATE TABLE app_user (
    user_id        UUID PRIMARY KEY,
    username       VARCHAR(60)  NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,
    full_name      VARCHAR(120) NOT NULL,
    role           VARCHAR(20)  NOT NULL CHECK (role IN ('ADMIN', 'CLINIC', 'CLINICIAN')),
    facility_id    UUID REFERENCES hospital_facility(facility_id),
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at  TIMESTAMPTZ,
    -- Clinic and clinician accounts always belong to a facility; admins never do.
    CHECK ((role = 'ADMIN' AND facility_id IS NULL) OR (role <> 'ADMIN' AND facility_id IS NOT NULL))
);

CREATE TABLE auth_session (
    token         VARCHAR(64) PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES app_user(user_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    ended_at      TIMESTAMPTZ
);

CREATE TABLE audit_event (
    event_id     UUID PRIMARY KEY,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    user_id      UUID REFERENCES app_user(user_id),
    username     VARCHAR(60),
    full_name    VARCHAR(120),
    role         VARCHAR(20),
    facility_id  UUID REFERENCES hospital_facility(facility_id),
    event_type   VARCHAR(40)  NOT NULL,
    patient_id   UUID REFERENCES patient(patient_id),
    target       VARCHAR(300),
    outcome      VARCHAR(20)  NOT NULL
);

CREATE TABLE patient_document (
    document_id   UUID PRIMARY KEY,
    patient_id    UUID         NOT NULL REFERENCES patient(patient_id),
    facility_id   UUID         NOT NULL REFERENCES hospital_facility(facility_id),
    uploaded_by   UUID         NOT NULL REFERENCES app_user(user_id),
    file_name     VARCHAR(255) NOT NULL,
    content_type  VARCHAR(100) NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    description   VARCHAR(300),
    content       BYTEA        NOT NULL,
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_user        ON auth_session(user_id);
CREATE INDEX idx_audit_occurred      ON audit_event(occurred_at DESC);
CREATE INDEX idx_audit_facility      ON audit_event(facility_id, occurred_at DESC);
CREATE INDEX idx_document_patient    ON patient_document(patient_id);
CREATE INDEX idx_user_facility       ON app_user(facility_id);
