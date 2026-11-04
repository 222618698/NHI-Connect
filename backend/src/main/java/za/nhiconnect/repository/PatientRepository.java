package za.nhiconnect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import za.nhiconnect.domain.Patient;
import java.util.UUID;
import java.util.Optional;

public interface PatientRepository extends JpaRepository<Patient, UUID> {
    Optional<Patient> findByNationalId(String nationalId);
}
