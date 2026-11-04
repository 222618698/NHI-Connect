package za.nhiconnect.domain;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.OffsetDateTime;

@Entity
@Table(name = "encounter")
public class Encounter {
    @Id
    @Column(name = "encounter_id")
    private UUID id;
    @Column(name = "patient_id")
    private UUID patientId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id")
    private HospitalFacility facility;
    @Column(name = "encounter_type")
    private String encounterType;
    private String title;
    private String notes;
    @Column(name = "admission_date")
    private OffsetDateTime admissionDate;
    @Column(name = "discharge_date")
    private OffsetDateTime dischargeDate;

    public UUID getId() { return id; }
    public UUID getPatientId() { return patientId; }
    public HospitalFacility getFacility() { return facility; }
    public String getEncounterType() { return encounterType; }
    public String getTitle() { return title; }
    public String getNotes() { return notes; }
    public OffsetDateTime getAdmissionDate() { return admissionDate; }
    public OffsetDateTime getDischargeDate() { return dischargeDate; }
}
