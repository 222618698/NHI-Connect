package za.nhiconnect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import za.nhiconnect.domain.Encounter;
import java.util.UUID;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;

public interface EncounterRepository extends JpaRepository<Encounter, UUID> {
    @EntityGraph(attributePaths = "facility")
    List<Encounter> findByPatientId(UUID patientId);
}
