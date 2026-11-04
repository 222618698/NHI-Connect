CREATE TABLE hospital_facility (
    facility_id      UUID PRIMARY KEY,
    name             VARCHAR(200) NOT NULL,
    short_name       VARCHAR(80)  NOT NULL,
    province         VARCHAR(60)  NOT NULL,
    connection_type  VARCHAR(40)  NOT NULL,
    status           VARCHAR(20)  NOT NULL,
    onboarded_at     TIMESTAMPTZ,
    last_synced_at   TIMESTAMPTZ
);

CREATE TABLE patient (
    patient_id     UUID PRIMARY KEY,
    national_id    VARCHAR(13) UNIQUE,
    first_name     VARCHAR(100) NOT NULL,
    surname        VARCHAR(100) NOT NULL,
    date_of_birth  DATE NOT NULL,
    sex            VARCHAR(10) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE master_patient_index (
    mpi_id            UUID PRIMARY KEY,
    patient_id        UUID NOT NULL REFERENCES patient(patient_id),
    facility_id       UUID NOT NULL REFERENCES hospital_facility(facility_id),
    local_patient_id  VARCHAR(60) NOT NULL,
    match_confidence  VARCHAR(30) NOT NULL,
    matched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, local_patient_id)
);

CREATE TABLE encounter (
    encounter_id    UUID PRIMARY KEY,
    patient_id      UUID NOT NULL REFERENCES patient(patient_id),
    facility_id     UUID NOT NULL REFERENCES hospital_facility(facility_id),
    encounter_type  VARCHAR(40) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    notes           TEXT,
    admission_date  TIMESTAMPTZ NOT NULL,
    discharge_date  TIMESTAMPTZ
);

CREATE TABLE observation (
    observation_id  UUID PRIMARY KEY,
    encounter_id    UUID REFERENCES encounter(encounter_id),
    patient_id      UUID NOT NULL REFERENCES patient(patient_id),
    facility_id     UUID NOT NULL REFERENCES hospital_facility(facility_id),
    code_standard   VARCHAR(60),
    code_local      VARCHAR(60),
    display_name    VARCHAR(200) NOT NULL,
    value           TEXT,
    unit            VARCHAR(40),
    observed_at     TIMESTAMPTZ NOT NULL
);

CREATE TABLE medication (
    medication_id   UUID PRIMARY KEY,
    encounter_id    UUID REFERENCES encounter(encounter_id),
    patient_id      UUID NOT NULL REFERENCES patient(patient_id),
    facility_id     UUID NOT NULL REFERENCES hospital_facility(facility_id),
    code_standard   VARCHAR(60),
    code_local      VARCHAR(60),
    display_name    VARCHAR(200) NOT NULL,
    dosage          TEXT,
    start_date      DATE NOT NULL,
    end_date        DATE
);

CREATE INDEX idx_encounter_patient   ON encounter(patient_id);
CREATE INDEX idx_observation_patient ON observation(patient_id);
CREATE INDEX idx_medication_patient  ON medication(patient_id);
CREATE INDEX idx_mpi_patient         ON master_patient_index(patient_id);
