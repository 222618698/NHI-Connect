package za.nhiconnect.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import za.nhiconnect.auth.AuditService;
import za.nhiconnect.auth.CurrentUser;

import java.io.IOException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Adds visits, lab results, medications and documents to a patient's record on behalf of the signed-in user.
 * The facility always comes from the user's account, never from the request.
 * Additions made by clinicians/nurses are also "sent" to their clinic for review (record_update).
 */
@Service
public class RecordEntryService {

    private static final ZoneId SA = ZoneId.of("Africa/Johannesburg");
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "application/pdf", "pdf", "image/png", "png", "image/jpeg", "jpg", "text/plain", "txt");
    private static final Map<String, String> TYPE_LABEL = Map.of(
            "ENCOUNTER", "Visit", "LAB", "Lab result", "MEDICATION", "Medication", "DOCUMENT", "Document");

    public record Entry(String type, LocalDate date, String encounterType, String title, String detail) {}

    public record DocumentInfo(UUID id, String fileName, String contentType, long sizeBytes, String description,
                               String facilityName, String uploadedBy, OffsetDateTime uploadedAt) {}

    public record RecordUpdate(UUID id, UUID patientId, String patientName, String nationalId, String facilityName,
                               String submittedBy, String entryType, String summary, OffsetDateTime submittedAt,
                               String reviewedBy, OffsetDateTime reviewedAt) {}

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public RecordEntryService(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @Transactional
    public UUID addEntry(CurrentUser user, UUID patientId, Entry e) {
        requirePatient(patientId);
        ensureLinked(patientId, user.facilityId(), null);

        UUID id = UUID.randomUUID();
        String title = e.title().trim();
        String detail = e.detail() == null || e.detail().isBlank() ? null : e.detail().trim();
        // The form captures a date only; store it at midday local time so it never shifts a day across time zones.
        OffsetDateTime when = e.date().atTime(12, 0).atZone(SA).toOffsetDateTime();
        switch (e.type()) {
            case "ENCOUNTER" -> jdbc.update("""
                    INSERT INTO encounter (encounter_id, patient_id, facility_id, encounter_type, title, notes, admission_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    id, patientId, user.facilityId(), e.encounterType() == null ? "OUTPATIENT" : e.encounterType(), title, detail, when);
            case "LAB" -> jdbc.update("""
                    INSERT INTO observation (observation_id, patient_id, facility_id, display_name, value, observed_at)
                    VALUES (?, ?, ?, ?, ?, ?)""",
                    id, patientId, user.facilityId(), title, detail == null ? "" : detail, when);
            case "MEDICATION" -> jdbc.update("""
                    INSERT INTO medication (medication_id, patient_id, facility_id, display_name, dosage, start_date)
                    VALUES (?, ?, ?, ?, ?, ?)""",
                    id, patientId, user.facilityId(), title, detail, e.date());
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown entry type.");
        }
        markFacilitySynced(user.facilityId());
        String summary = TYPE_LABEL.get(e.type()) + " on " + e.date() + ": " + title;
        audit.log(user, "ENTRY_ADDED", patientId, summary, AuditService.SUCCESS);
        sendForReview(user, patientId, e.type(), id, summary);
        return id;
    }

    @Transactional
    public DocumentInfo uploadDocument(CurrentUser user, UUID patientId, MultipartFile file, String description) throws IOException {
        requirePatient(patientId);
        if (file == null || file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a file to upload.");
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!ALLOWED_TYPES.containsKey(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF, PNG, JPEG or plain-text files can be uploaded.");
        }
        String fileName = za.nhiconnect.util.FileNames.clean(file.getOriginalFilename(), ALLOWED_TYPES.get(type));
        String desc = description == null || description.isBlank() ? null : description.trim();
        if (desc != null && desc.length() > 300) desc = desc.substring(0, 300);

        ensureLinked(patientId, user.facilityId(), null);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_document (document_id, patient_id, facility_id, uploaded_by, file_name, content_type, size_bytes, description, content)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                id, patientId, user.facilityId(), user.id(), fileName, type, file.getSize(), desc, file.getBytes());
        markFacilitySynced(user.facilityId());
        audit.log(user, "DOCUMENT_UPLOADED", patientId, fileName, AuditService.SUCCESS);
        sendForReview(user, patientId, "DOCUMENT", id, "Document: " + fileName + (desc != null ? " (" + desc + ")" : ""));
        return listDocuments(patientId).stream().filter(d -> d.id().equals(id)).findFirst().orElseThrow();
    }

    public List<DocumentInfo> listDocuments(UUID patientId) {
        return jdbc.query("""
                SELECT d.document_id, d.file_name, d.content_type, d.size_bytes, d.description, f.name AS facility_name,
                       u.full_name AS uploaded_by, d.uploaded_at
                FROM patient_document d
                JOIN hospital_facility f ON f.facility_id = d.facility_id
                JOIN app_user u ON u.user_id = d.uploaded_by
                WHERE d.patient_id = ? ORDER BY d.uploaded_at DESC
                """, (rs, i) -> new DocumentInfo(rs.getObject("document_id", UUID.class),
                rs.getString("file_name"), rs.getString("content_type"), rs.getLong("size_bytes"), rs.getString("description"),
                rs.getString("facility_name"), rs.getString("uploaded_by"), rs.getObject("uploaded_at", OffsetDateTime.class)), patientId);
    }

    // ------------------------------------------------------------------ updates sent for review

    /** Updates sent by clinicians. {@code facilityId} null = every clinic (administrator view). */
    public List<RecordUpdate> listUpdates(UUID facilityId, int limit) {
        String where = facilityId == null ? "" : "WHERE r.facility_id = ?";
        Object[] args = facilityId == null ? new Object[]{limit} : new Object[]{facilityId, limit};
        return jdbc.query("""
                SELECT r.update_id, r.patient_id, p.first_name || ' ' || p.surname AS patient_name, p.national_id,
                       f.name AS facility_name, s.full_name AS submitted_by, r.entry_type, r.summary, r.submitted_at,
                       v.full_name AS reviewed_by, r.reviewed_at
                FROM record_update r
                JOIN patient p ON p.patient_id = r.patient_id
                JOIN hospital_facility f ON f.facility_id = r.facility_id
                JOIN app_user s ON s.user_id = r.submitted_by
                LEFT JOIN app_user v ON v.user_id = r.reviewed_by
                """ + where + """

                ORDER BY (r.reviewed_at IS NULL) DESC, r.submitted_at DESC
                LIMIT ?
                """, (rs, i) -> new RecordUpdate(rs.getObject("update_id", UUID.class), rs.getObject("patient_id", UUID.class),
                rs.getString("patient_name"), rs.getString("national_id"), rs.getString("facility_name"),
                rs.getString("submitted_by"), rs.getString("entry_type"), rs.getString("summary"),
                rs.getObject("submitted_at", OffsetDateTime.class), rs.getString("reviewed_by"),
                rs.getObject("reviewed_at", OffsetDateTime.class)), args);
    }

    /** Marks an update reviewed. Clinic staff may only review their own clinic's updates. */
    @Transactional
    public void markReviewed(CurrentUser user, UUID updateId) {
        var rows = jdbc.queryForList("SELECT patient_id, facility_id, summary, reviewed_at FROM record_update WHERE update_id = ?", updateId);
        if (rows.isEmpty() || !user.facilityId().equals(rows.get(0).get("facility_id"))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Update not found.");
        }
        if (rows.get(0).get("reviewed_at") != null) return;
        jdbc.update("UPDATE record_update SET reviewed_by = ?, reviewed_at = now() WHERE update_id = ?", user.id(), updateId);
        audit.log(user, "UPDATE_REVIEWED", (UUID) rows.get(0).get("patient_id"), (String) rows.get(0).get("summary"), AuditService.SUCCESS);
    }

    // ------------------------------------------------------------------ helpers

    /**
     * A manual entry is new data from that facility, so its "last synced" time moves forward. Without this the
     * timeline labelled a just-entered result with the facility's old batch-sync date (REQ-007, DEF-009).
     */
    private void markFacilitySynced(UUID facilityId) {
        jdbc.update("UPDATE hospital_facility SET last_synced_at = now() WHERE facility_id = ?", facilityId);
    }

    private void sendForReview(CurrentUser user, UUID patientId, String type, UUID entryId, String summary) {
        if (!CurrentUser.CLINICIAN.equals(user.role())) return; // clinic staff entries don't need their own review
        jdbc.update("""
                INSERT INTO record_update (update_id, patient_id, facility_id, submitted_by, entry_type, entry_id, summary)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                UUID.randomUUID(), patientId, user.facilityId(), user.id(), type, entryId,
                summary.length() > 300 ? summary.substring(0, 300) : summary);
    }

    public void requirePatient(UUID patientId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM patient WHERE patient_id = ?", Integer.class, patientId);
        if (n == null || n == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found.");
    }

    /** Adds the patient to the facility's Master Patient Index if they aren't linked yet. */
    public void ensureLinked(UUID patientId, UUID facilityId, String localPatientId) {
        Integer linked = jdbc.queryForObject("SELECT count(*) FROM master_patient_index WHERE patient_id = ? AND facility_id = ?",
                Integer.class, patientId, facilityId);
        if (linked != null && linked > 0) return;
        String localId = localPatientId == null || localPatientId.isBlank()
                ? "NHI-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase()
                : localPatientId.trim();
        Integer clash = jdbc.queryForObject("SELECT count(*) FROM master_patient_index WHERE facility_id = ? AND local_patient_id = ?",
                Integer.class, facilityId, localId);
        if (clash != null && clash > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Another patient at this clinic already uses file number " + localId + ".");
        }
        jdbc.update("INSERT INTO master_patient_index (mpi_id, patient_id, facility_id, local_patient_id, match_confidence) VALUES (?, ?, ?, ?, 'MANUAL_ENTRY')",
                UUID.randomUUID(), patientId, facilityId, localId);
    }
}
