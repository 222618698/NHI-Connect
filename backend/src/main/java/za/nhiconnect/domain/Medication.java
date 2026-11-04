package za.nhiconnect.domain;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.LocalDate;

@Entity
@Table(name = "medication")
public class Medication {
    @Id
    @Column(name = "medication_id")
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
    private String dosage;
    @Column(name = "start_date")
    private LocalDate startDate;
    @Column(name = "end_date")
    private LocalDate endDate;

    public UUID getId() { return id; }
    public UUID getPatientId() { return patientId; }
    public HospitalFacility getFacility() { return facility; }
    public String getCodeStandard() { return codeStandard; }
    public String getDisplayName() { return displayName; }
    public String getDosage() { return dosage; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
}
