package za.nhiconnect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import za.nhiconnect.domain.Observation;
import java.util.UUID;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;

public interface ObservationRepository extends JpaRepository<Observation, UUID> {
    @EntityGraph(attributePaths = "facility")
    List<Observation> findByPatientId(UUID patientId);
}
