package za.nhiconnect.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import za.nhiconnect.auth.AuditService;
import za.nhiconnect.auth.CurrentUser;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Consent & Break-Glass Layer (REQ-006, Design §3.2.2 checkAccess / invokeBreakGlass).
 * Every read of a patient's clinical data calls {@link #requireAccess}; a clinician blocked by a restriction may
 * invoke break-glass, which grants that single request only and is flagged for administrator review.
 */
@Service
public class ConsentService {

    public static final Set<String> REASON_CODES = Set.of("LIFE_THREATENING", "UNCONSCIOUS_PATIENT", "URGENT_CONTINUITY_OF_CARE", "OTHER");

    public record Restriction(UUID id, UUID patientId, UUID ownerFacilityId, String ownerFacilityName,
                              UUID excludedFacilityId, String excludedFacilityName, String reason,
                              String createdBy, OffsetDateTime createdAt) {}

    public record BreakGlassEvent(UUID id, UUID patientId, String patientName, String userName, String facilityName,
                                  String reasonCode, String freeText, OffsetDateTime createdAt, String reviewStatus,
                                  String reviewedBy, OffsetDateTime reviewedAt, String reviewNote) {}

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public ConsentService(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    /**
     * The access rule: a restriction excludes a facility if it names that facility, or if it names no facility
     * ("all others") and the facility is not the one that recorded it. Users with no facility are always excluded.
     */
    public static boolean excludes(UUID ownerFacilityId, UUID excludedFacilityId, UUID userFacilityId) {
        if (userFacilityId == null) return true;
        return excludedFacilityId == null ? !ownerFacilityId.equals(userFacilityId) : excludedFacilityId.equals(userFacilityId);
    }

    public List<Restriction> active(UUID patientId) {
        return jdbc.query("""
                SELECT r.restriction_id, r.patient_id, r.owner_facility_id, o.name AS owner_name, r.excluded_facility_id,
                       x.name AS excluded_name, r.reason, u.full_name AS created_by, r.created_at
                FROM consent_restriction r
                JOIN hospital_facility o ON o.facility_id = r.owner_facility_id
                LEFT JOIN hospital_facility x ON x.facility_id = r.excluded_facility_id
                JOIN app_user u ON u.user_id = r.created_by
                WHERE r.patient_id = ? AND r.lifted_at IS NULL ORDER BY r.created_at
                """, (rs, i) -> new Restriction(rs.getObject("restriction_id", UUID.class), rs.getObject("patient_id", UUID.class),
                rs.getObject("owner_facility_id", UUID.class), rs.getString("owner_name"),
                rs.getObject("excluded_facility_id", UUID.class), rs.getString("excluded_name"), rs.getString("reason"),
                rs.getString("created_by"), rs.getObject("created_at", OffsetDateTime.class)), patientId);
    }

    public Optional<Restriction> blocking(CurrentUser user, UUID patientId) {
        return active(patientId).stream()
                .filter(r -> excludes(r.ownerFacilityId(), r.excludedFacilityId(), user.facilityId()))
                .findFirst();
    }

    /** Throws {@link ConsentRestrictedException} (and audits the denial) if a restriction blocks this user. */
    public void requireAccess(CurrentUser user, UUID patientId) {
        blocking(user, patientId).ifPresent(r -> {
            audit.log(user, "CONSENT_BLOCKED", patientId, "Restriction recorded at " + r.ownerFacilityName(), AuditService.FLAGGED);
            boolean canBreakGlass = CurrentUser.CLINICIAN.equals(user.role());
            throw new ConsentRestrictedException(
                    "This patient has restricted access to their record from your facility (recorded at " + r.ownerFacilityName() + ")."
                            + (canBreakGlass ? " In an emergency you may use break-glass access; it will be logged and reviewed." : ""),
                    canBreakGlass);
        });
    }

    @Transactional
    public Restriction add(CurrentUser clinic, UUID patientId, UUID excludedFacilityId, String reason) {
        if (excludedFacilityId != null && excludedFacilityId.equals(clinic.facilityId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A restriction cannot exclude the clinic recording it.");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO consent_restriction (restriction_id, patient_id, owner_facility_id, excluded_facility_id, reason, created_by)
                VALUES (?, ?, ?, ?, ?, ?)""", id, patientId, clinic.facilityId(), excludedFacilityId, reason.trim(), clinic.id());
        Restriction r = active(patientId).stream().filter(x -> x.id().equals(id)).findFirst().orElseThrow();
        audit.log(clinic, "CONSENT_ADDED", patientId,
                "Hidden from " + (r.excludedFacilityName() == null ? "all other facilities" : r.excludedFacilityName()), AuditService.SUCCESS);
        return r;
    }

    @Transactional
    public void lift(CurrentUser clinic, UUID patientId, UUID restrictionId) {
        int n = jdbc.update("""
                UPDATE consent_restriction SET lifted_by = ?, lifted_at = now()
                WHERE restriction_id = ? AND patient_id = ? AND owner_facility_id = ? AND lifted_at IS NULL""",
                clinic.id(), restrictionId, patientId, clinic.facilityId());
        if (n == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Restriction not found at your clinic.");
        audit.log(clinic, "CONSENT_LIFTED", patientId, "Restriction lifted", AuditService.SUCCESS);
    }

    /** Logs a break-glass override. The caller then returns the record for this one request only. */
    @Transactional
    public void recordBreakGlass(CurrentUser user, UUID patientId, String reasonCode, String freeText) {
        if (blocking(user, patientId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No consent restriction applies; break-glass is not needed.");
        }
        jdbc.update("""
                INSERT INTO break_glass_event (event_id, patient_id, user_id, facility_id, reason_code, free_text)
                VALUES (?, ?, ?, ?, ?, ?)""", UUID.randomUUID(), patientId, user.id(), user.facilityId(), reasonCode, freeText.trim());
        audit.log(user, "BREAK_GLASS", patientId, reasonCode + ": " + freeText.trim(), AuditService.FLAGGED);
    }

    public List<BreakGlassEvent> breakGlassEvents(int limit) {
        return jdbc.query("""
                SELECT b.event_id, b.patient_id, p.first_name || ' ' || p.surname AS patient_name, u.full_name AS user_name,
                       f.name AS facility_name, b.reason_code, b.free_text, b.created_at, b.review_status,
                       r.full_name AS reviewed_by, b.reviewed_at, b.review_note
                FROM break_glass_event b
                JOIN patient p ON p.patient_id = b.patient_id
                JOIN app_user u ON u.user_id = b.user_id
                JOIN hospital_facility f ON f.facility_id = b.facility_id
                LEFT JOIN app_user r ON r.user_id = b.reviewed_by
                ORDER BY (b.review_status = 'PENDING_REVIEW') DESC, b.created_at DESC LIMIT ?
                """, (rs, i) -> new BreakGlassEvent(rs.getObject("event_id", UUID.class), rs.getObject("patient_id", UUID.class),
                rs.getString("patient_name"), rs.getString("user_name"), rs.getString("facility_name"), rs.getString("reason_code"),
                rs.getString("free_text"), rs.getObject("created_at", OffsetDateTime.class), rs.getString("review_status"),
                rs.getString("reviewed_by"), rs.getObject("reviewed_at", OffsetDateTime.class), rs.getString("review_note")), limit);
    }

    @Transactional
    public void review(CurrentUser admin, UUID eventId, String decision, String note) {
        if (!Set.of("JUSTIFIED", "NOT_JUSTIFIED").contains(decision)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Decision must be JUSTIFIED or NOT_JUSTIFIED.");
        }
        var rows = jdbc.queryForList("SELECT patient_id FROM break_glass_event WHERE event_id = ? AND review_status = 'PENDING_REVIEW'", eventId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No pending break-glass event with that ID.");
        jdbc.update("UPDATE break_glass_event SET review_status = ?, reviewed_by = ?, reviewed_at = now(), review_note = ? WHERE event_id = ?",
                decision, admin.id(), note == null ? null : note.trim(), eventId);
        audit.log(admin, "BREAK_GLASS_REVIEWED", (UUID) rows.get(0).get("patient_id"), decision + (note == null || note.isBlank() ? "" : ": " + note.trim()),
                "JUSTIFIED".equals(decision) ? AuditService.SUCCESS : AuditService.FLAGGED);
    }
}
