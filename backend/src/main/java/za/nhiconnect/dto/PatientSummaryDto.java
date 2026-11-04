package za.nhiconnect.dto;

import java.time.LocalDate;
import java.util.UUID;

public record PatientSummaryDto(UUID patientId, String nationalId, String fullName, LocalDate dateOfBirth, String sex) {}
