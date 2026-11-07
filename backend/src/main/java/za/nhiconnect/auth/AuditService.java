package za.nhiconnect.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/** Writes the audit trail: every sign-in, record access and data change. */
@Service
public class AuditService {

    public static final String SUCCESS = "SUCCESS";
    public static final String FAILED = "FAILED";
    public static final String FLAGGED = "FLAGGED";

    private final JdbcTemplate jdbc;

    public AuditService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void log(CurrentUser user, String eventType, UUID patientId, String target, String outcome) {
        jdbc.update("""
                INSERT INTO audit_event (event_id, user_id, username, full_name, role, facility_id, event_type, patient_id, target, outcome)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                UUID.randomUUID(),
                user == null ? null : user.id(),
                user == null ? null : user.username(),
                user == null ? null : user.fullName(),
                user == null ? null : user.role(),
                user == null ? null : user.facilityId(),
                eventType, patientId, truncate(target), outcome);
    }

    /** For events with no signed-in user, e.g. a failed sign-in. */
    public void logAnonymous(String username, String eventType, String target, String outcome) {
        jdbc.update("""
                INSERT INTO audit_event (event_id, username, event_type, target, outcome)
                VALUES (?, ?, ?, ?, ?)""",
                UUID.randomUUID(), truncate(username, 60), eventType, truncate(target), outcome);
    }

    private static String truncate(String s) { return truncate(s, 300); }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
