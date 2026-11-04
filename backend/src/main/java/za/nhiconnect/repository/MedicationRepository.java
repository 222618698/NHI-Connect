package za.nhiconnect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import za.nhiconnect.domain.Medication;
import java.util.UUID;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;

public interface MedicationRepository extends JpaRepository<Medication, UUID> {
    @EntityGraph(attributePaths = "facility")
    List<Medication> findByPatientId(UUID patientId);
}
