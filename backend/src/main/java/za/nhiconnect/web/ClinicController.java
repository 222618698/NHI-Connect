package za.nhiconnect.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import za.nhiconnect.auth.AuditService;
import za.nhiconnect.auth.CurrentUser;
import za.nhiconnect.service.RecordEntryService;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Clinic portal API. A clinic account manages patients for its own facility only (the facility always comes from
 * the signed-in account), and reviews the record updates its clinicians and nurses send in.
 * Adding visits/lab results/medications and documents uses the shared patient endpoints.
 */
@RestController
@RequestMapping("/engine/api/v1/clinic")
public class ClinicController {

    public record FacilityInfo(UUID id, String name, String province) {}
    public record Staff(UUID id, String username, String fullName, String role, boolean active,
                        OffsetDateTime lastLoginAt, boolean signedInNow) {}
    public record ClinicStats(int patients, int entriesAddedThisMonth, int documents, int pendingUpdates) {}
    public record ClinicOverview(FacilityInfo facility, ClinicStats stats, List<Staff> staff, List<AdminController.AuditRow> recentActivity) {}

    public record ClinicPatient(UUID patientId, String nationalId, String fullName, LocalDate dateOfBirth, String sex,
                                String localPatientId, OffsetDateTime linkedAt, int documentCount) {}
    public record NewPatient(
            @NotBlank(message = "Enter the patient's ID number.") @Pattern(regexp = "\\d{13}", message = "ID number must be 13 digits.") String nationalId,
            @NotBlank(message = "Enter the patient's first name(s).") @Size(max = 100) String firstName,
            @NotBlank(message = "Enter the patient's surname.") @Size(max = 100) String surname,
            @NotNull(message = "Enter the date of birth.") @PastOrPresent(message = "Date of birth can't be in the future.") LocalDate dateOfBirth,
            @NotBlank(message = "Choose the patient's sex.") @Pattern(regexp = "Male|Female", message = "Sex must be Male or Female.") String sex,
            @Size(max = 60) String localPatientId) {}
    public record AddPatientResult(ClinicPatient patient, boolean alreadyOnNationalRecord) {}

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final RecordEntryService entries;

    public ClinicController(JdbcTemplate jdbc, AuditService audit, RecordEntryService entries) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.entries = entries;
    }

    // ------------------------------------------------------------------ overview: staff + who signed in

    @GetMapping("/overview")
    public ClinicOverview overview(HttpServletRequest request) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINIC);
        UUID fid = user.facilityId();
        FacilityInfo facility = jdbc.queryForObject("SELECT facility_id, name, province FROM hospital_facility WHERE facility_id = ?",
                (rs, i) -> new FacilityInfo(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3)), fid);
        ClinicStats stats = jdbc.queryForObject("""
                SELECT (SELECT count(DISTINCT patient_id) FROM master_patient_index WHERE facility_id = ?),
                       (SELECT count(*) FROM audit_event WHERE facility_id = ? AND event_type = 'ENTRY_ADDED'
                                                      AND occurred_at >= date_trunc('month', now())),
                       (SELECT count(*) FROM patient_document WHERE facility_id = ?),
                       (SELECT count(*) FROM record_update WHERE facility_id = ? AND reviewed_at IS NULL)
                """, (rs, i) -> new ClinicStats(rs.getInt(1), rs.getInt(2), rs.getInt(3), rs.getInt(4)), fid, fid, fid, fid);
        List<Staff> staff = jdbc.query("""
                SELECT u.user_id, u.username, u.full_name, u.role, u.active, u.last_login_at,
                       EXISTS (SELECT 1 FROM auth_session s WHERE s.user_id = u.user_id
                               AND s.ended_at IS NULL AND s.expires_at > now()
                               AND s.last_seen_at > now() - make_interval(mins => %d)) AS signed_in
                FROM app_user u WHERE u.facility_id = ? ORDER BY u.role, u.full_name
                """.formatted(AdminController.ACTIVE_MINUTES), (rs, i) -> new Staff(rs.getObject("user_id", UUID.class), rs.getString("username"),
                rs.getString("full_name"), rs.getString("role"), rs.getBoolean("active"),
                rs.getObject("last_login_at", OffsetDateTime.class), rs.getBoolean("signed_in")), fid);
        return new ClinicOverview(facility, stats, staff, AdminController.queryAudit(jdbc, fid, null, null, 50));
    }

    // ------------------------------------------------------------------ updates sent in by clinicians / nurses

    @GetMapping("/updates")
    public List<RecordEntryService.RecordUpdate> updates(HttpServletRequest request) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINIC);
        return entries.listUpdates(user.facilityId(), 100);
    }

    @PostMapping("/updates/{updateId}/review")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void review(HttpServletRequest request, @PathVariable UUID updateId) {
        entries.markReviewed(CurrentUser.require(request, CurrentUser.CLINIC), updateId);
    }

    // ------------------------------------------------------------------ patients

    private static final String PATIENT_SELECT = """
            SELECT p.patient_id, p.national_id, p.first_name || ' ' || p.surname AS full_name, p.date_of_birth, p.sex,
                   m.local_patient_id, m.matched_at,
                   (SELECT count(*) FROM patient_document d WHERE d.patient_id = p.patient_id) AS document_count
            FROM master_patient_index m JOIN patient p ON p.patient_id = m.patient_id
            WHERE m.facility_id = ?
            """;

    private static ClinicPatient patientRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ClinicPatient(rs.getObject("patient_id", UUID.class), rs.getString("national_id"), rs.getString("full_name"),
                rs.getObject("date_of_birth", LocalDate.class), rs.getString("sex"), rs.getString("local_patient_id"),
                rs.getObject("matched_at", OffsetDateTime.class), rs.getInt("document_count"));
    }

    @GetMapping("/patients")
    public List<ClinicPatient> patients(HttpServletRequest request) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINIC);
        return jdbc.query(PATIENT_SELECT + " ORDER BY p.surname, p.first_name", (rs, i) -> patientRow(rs), user.facilityId());
    }

    /** Adds a patient to this clinic. If the ID number is already on the national record, links that patient instead. */
    @PostMapping("/patients")
    @Transactional
    public AddPatientResult addPatient(HttpServletRequest request, @Valid @RequestBody NewPatient body) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINIC);
        if (!za.nhiconnect.util.SaIdNumber.matchesDateOfBirth(body.nationalId(), body.dateOfBirth())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The date of birth doesn't match the ID number (an SA ID starts with YYMMDD). Check both and try again.");
        }

        var existing = jdbc.query("SELECT patient_id FROM patient WHERE national_id = ?",
                (rs, i) -> rs.getObject(1, UUID.class), body.nationalId());
        boolean alreadyNational = !existing.isEmpty();
        UUID patientId;
        if (alreadyNational) {
            patientId = existing.get(0);
        } else {
            patientId = UUID.randomUUID();
            jdbc.update("INSERT INTO patient (patient_id, national_id, first_name, surname, date_of_birth, sex) VALUES (?, ?, ?, ?, ?, ?)",
                    patientId, body.nationalId(), body.firstName().trim(), body.surname().trim(), body.dateOfBirth(), body.sex());
        }
        entries.ensureLinked(patientId, user.facilityId(), body.localPatientId());
        audit.log(user, alreadyNational ? "PATIENT_LINKED" : "PATIENT_CREATED", patientId,
                "ID: " + body.nationalId(), AuditService.SUCCESS);

        ClinicPatient patient = jdbc.queryForObject(PATIENT_SELECT + " AND p.patient_id = ?", (rs, i) -> patientRow(rs),
                user.facilityId(), patientId);
        return new AddPatientResult(patient, alreadyNational);
    }
}
