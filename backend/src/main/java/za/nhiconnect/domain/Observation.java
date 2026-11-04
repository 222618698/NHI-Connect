package za.nhiconnect.domain;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.OffsetDateTime;

@Entity
@Table(name = "observation")
public class Observation {
    @Id
    @Column(name = "observation_id")
    private UUID id;
    @Column(name = "patient_id")
    private UUID patientId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id")
    private HospitalFacility facility;
    @Column(name = "code_standard")
    private String codeStandard;
    @Column(name = "code_local")
    private String codeLocal;
    @Column(name = "display_name")
    private String displayName;
    private String value;
    private String unit;
    @Column(name = "observed_at")
    private OffsetDateTime observedAt;

    public UUID getId() { return id; }
    public UUID getPatientId() { return patientId; }
    public HospitalFacility getFacility() { return facility; }
    public String getCodeStandard() { return codeStandard; }
    public String getCodeLocal() { return codeLocal; }
    public String getDisplayName() { return displayName; }
    public String getValue() { return value; }
    public String getUnit() { return unit; }
    public OffsetDateTime getObservedAt() { return observedAt; }
}
