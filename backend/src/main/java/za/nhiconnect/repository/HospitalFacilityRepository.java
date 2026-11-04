package za.nhiconnect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import za.nhiconnect.domain.HospitalFacility;
import java.util.UUID;

public interface HospitalFacilityRepository extends JpaRepository<HospitalFacility, UUID> {
}
