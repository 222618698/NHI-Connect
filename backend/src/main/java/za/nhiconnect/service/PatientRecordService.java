package za.nhiconnect.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.nhiconnect.domain.*;
import za.nhiconnect.dto.*;
import za.nhiconnect.repository.*;

import java.time.ZoneId;
import java.util.*;
import java.util.stream.Stream;

@Service
@Transactional(readOnly = true)
public class PatientRecordService {

    private static final String COMPLETENESS_NOTICE =
            "Not all facilities nationwide are connected to NHI-Connect yet. "
          + "This timeline reflects only onboarded and synced hospitals.";

    private final PatientRepository patients;
    private final EncounterRepository encounters;
    private final ObservationRepository observations;
    private final MedicationRepository medications;

    public PatientRecordService(PatientRepository patients, EncounterRepository encounters,
                                ObservationRepository observations, MedicationRepository medications) {
        this.patients = patients;
        this.encounters = encounters;
        this.observations = observations;
        this.medications = medications;
    }

    /** Deterministic lookup by 13-digit SA ID (MPI step 1). */
    public Optional<PatientSummaryDto> findByNationalId(String nationalId) {
        return patients.findByNationalId(nationalId).map(this::toSummary);
    }

    public Optional<UnifiedRecordDto> getUnifiedRecord(UUID patientId) {
        return patients.findById(patientId).map(p -> {
            List<TimelineEntryDto> timeline = Stream.of(
                    encounters.findByPatientId(patientId).stream().map(this::fromEncounter),
                    observations.findByPatientId(patientId).stream().map(this::fromObservation),
                    medications.findByPatientId(patientId).stream().map(this::fromMedication))
                .flatMap(s -> s)
                .sorted(Comparator.comparing(TimelineEntryDto::date))
                .toList();

            Set<String> facilities = new LinkedHashSet<>();
            Set<String> provinces = new LinkedHashSet<>();
            timeline.forEach(t -> { facilities.add(t.facilityName()); provinces.add(t.province()); });

            return new UnifiedRecordDto(toSummary(p), facilities.size(), List.copyOf(provinces), timeline, COMPLETENESS_NOTICE);
        });
    }

    private PatientSummaryDto toSummary(Patient p) {
        return new PatientSummaryDto(p.getId(), p.getNationalId(), p.getFirstName() + " " + p.getSurname(), p.getDateOfBirth(), p.getSex());
    }

    private TimelineEntryDto fromEncounter(Encounter e) {
        HospitalFacility f = e.getFacility();
        return new TimelineEntryDto(e.getId(), "ENCOUNTER", e.getAdmissionDate(), e.getTitle(), e.getNotes(),
                f.getName(), f.getShortName(), f.getProvince(), f.getLastSyncedAt());
    }

    private TimelineEntryDto fromObservation(Observation o) {
        HospitalFacility f = o.getFacility();
        String detail = o.getValue() + (o.getUnit() != null ? " " + o.getUnit() : "");
        return new TimelineEntryDto(o.getId(), "LAB", o.getObservedAt(), o.getDisplayName(), detail,
                f.getName(), f.getShortName(), f.getProvince(), f.getLastSyncedAt());
    }

    private TimelineEntryDto fromMedication(Medication m) {
        HospitalFacility f = m.getFacility();
        var start = m.getStartDate().atStartOfDay(ZoneId.of("Africa/Johannesburg")).toOffsetDateTime();
        return new TimelineEntryDto(m.getId(), "MEDICATION", start, m.getDisplayName(), m.getDosage(),
                f.getName(), f.getShortName(), f.getProvince(), f.getLastSyncedAt());
    }
}
