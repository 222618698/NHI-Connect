package za.nhiconnect.domain;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.OffsetDateTime;

@Entity
@Table(name = "hospital_facility")
public class HospitalFacility {
    @Id
    @Column(name = "facility_id")
    private UUID id;
    private String name;
    @Column(name = "short_name")
    private String shortName;
    private String province;
    @Column(name = "connection_type")
    private String connectionType;
    private String status;
    @Column(name = "onboarded_at")
    private OffsetDateTime onboardedAt;
    @Column(name = "last_synced_at")
    private OffsetDateTime lastSyncedAt;

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getShortName() { return shortName; }
    public String getProvince() { return province; }
    public String getConnectionType() { return connectionType; }
    public String getStatus() { return status; }
    public OffsetDateTime getOnboardedAt() { return onboardedAt; }
    public OffsetDateTime getLastSyncedAt() { return lastSyncedAt; }
}
