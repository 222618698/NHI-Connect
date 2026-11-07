-- REQ-006: patient consent restrictions and logged break-glass (emergency) access.

-- A restriction is recorded at the facility where the patient asked for it (owner).
-- excluded_facility_id NULL means "every facility except the owner"; otherwise only that facility is excluded.
CREATE TABLE consent_restriction (
    restriction_id        UUID PRIMARY KEY,
    patient_id            UUID         NOT NULL REFERENCES patient(patient_id),
    owner_facility_id     UUID         NOT NULL REFERENCES hospital_facility(facility_id),
    excluded_facility_id  UUID REFERENCES hospital_facility(facility_id),
    reason                VARCHAR(300) NOT NULL,
    created_by            UUID         NOT NULL REFERENCES app_user(user_id),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    lifted_by             UUID REFERENCES app_user(user_id),
    lifted_at             TIMESTAMPTZ
);

CREATE TABLE break_glass_event (
    event_id       UUID PRIMARY KEY,
    patient_id     UUID         NOT NULL REFERENCES patient(patient_id),
    user_id        UUID         NOT NULL REFERENCES app_user(user_id),
    facility_id    UUID         NOT NULL REFERENCES hospital_facility(facility_id),
    reason_code    VARCHAR(40)  NOT NULL,
    free_text      VARCHAR(500) NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    review_status  VARCHAR(20)  NOT NULL DEFAULT 'PENDING_REVIEW'
                   CHECK (review_status IN ('PENDING_REVIEW', 'JUSTIFIED', 'NOT_JUSTIFIED')),
    reviewed_by    UUID REFERENCES app_user(user_id),
    reviewed_at    TIMESTAMPTZ,
    review_note    VARCHAR(500)
);

CREATE INDEX idx_consent_patient_active ON consent_restriction(patient_id) WHERE lifted_at IS NULL;
CREATE INDEX idx_break_glass_status     ON break_glass_event(review_status, created_at DESC);
