-- Clinicians and nurses can add to a patient's record (e.g. a blood test result they received).
-- Each such addition is "sent" to their clinic for review and is visible to administrators.
CREATE TABLE record_update (
    update_id     UUID PRIMARY KEY,
    patient_id    UUID         NOT NULL REFERENCES patient(patient_id),
    facility_id   UUID         NOT NULL REFERENCES hospital_facility(facility_id),
    submitted_by  UUID         NOT NULL REFERENCES app_user(user_id),
    entry_type    VARCHAR(20)  NOT NULL CHECK (entry_type IN ('ENCOUNTER', 'LAB', 'MEDICATION', 'DOCUMENT')),
    entry_id      UUID         NOT NULL,
    summary       VARCHAR(300) NOT NULL,
    submitted_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reviewed_by   UUID REFERENCES app_user(user_id),
    reviewed_at   TIMESTAMPTZ
);

CREATE INDEX idx_update_facility ON record_update(facility_id, submitted_at DESC);
CREATE INDEX idx_update_pending  ON record_update(facility_id) WHERE reviewed_at IS NULL;
