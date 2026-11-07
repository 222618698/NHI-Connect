package za.nhiconnect.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import za.nhiconnect.auth.AuditService;
import za.nhiconnect.auth.AuthService;
import za.nhiconnect.auth.CurrentUser;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** System Administrator API: clinics, user accounts, who is signed in, and the audit trail. */
@RestController
@RequestMapping("/engine/api/v1/admin")
public class AdminController {

    public record Stats(int facilities, int users, int patients, int signInsToday, int failedSignInsToday, int recordViewsToday) {}
    public record ActiveSession(String username, String fullName, String role, String facilityName,
                                OffsetDateTime signedInAt, OffsetDateTime lastSeenAt) {}
    public record Overview(Stats stats, List<ActiveSession> activeSessions) {}

    public record Facility(UUID id, String name, String shortName, String province, String connectionType, String status,
                           OffsetDateTime onboardedAt, OffsetDateTime lastSyncedAt, int userCount, int patientCount) {}
    public record NewFacility(@NotBlank(message = "Enter the clinic name.") @Size(max = 200) String name,
                              @NotBlank(message = "Choose a province.") @Size(max = 60) String province) {}

    public record User(UUID id, String username, String fullName, String role, UUID facilityId, String facilityName,
                       boolean active, OffsetDateTime createdAt, OffsetDateTime lastLoginAt) {}
    public record NewUser(
            @NotBlank(message = "Enter a username.")
            @Pattern(regexp = "[a-zA-Z0-9._-]{3,60}", message = "Usernames are 3-60 letters, numbers, dots, dashes or underscores.")
            String username,
            @NotBlank(message = "Enter the person's full name.") @Size(max = 120) String fullName,
            @NotBlank(message = "Enter a password.") @Size(min = 8, max = 100, message = "Passwords must be at least 8 characters.") String password,
            @NotBlank(message = "Choose a role.") String role,
            UUID facilityId) {}
    public record UserStatus(@NotNull Boolean active) {}
    public record PasswordReset(@NotBlank @Size(min = 8, max = 100, message = "Passwords must be at least 8 characters.") String password) {}

    public record AuditRow(UUID id, OffsetDateTime occurredAt, String username, String fullName, String role,
                           String facilityName, String eventType, String patientName, String target, String outcome) {}

    /** Someone counts as "signed in now" if their open session was used within this many minutes. */
    static final int ACTIVE_MINUTES = 30;

    private final JdbcTemplate jdbc;
    private final AuthService auth;
    private final AuditService audit;

    private final za.nhiconnect.service.RecordEntryService entries;

    private final za.nhiconnect.service.ConsentService consent;

    public AdminController(JdbcTemplate jdbc, AuthService auth, AuditService audit, za.nhiconnect.service.RecordEntryService entries,
                           za.nhiconnect.service.ConsentService consent) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.audit = audit;
        this.entries = entries;
        this.consent = consent;
    }

    // ------------------------------------------------------------------ overview

    @GetMapping("/overview")
    public Overview overview(HttpServletRequest request) {
        CurrentUser.require(request, CurrentUser.ADMIN);
        Stats stats = jdbc.queryForObject("""
                SELECT (SELECT count(*) FROM hospital_facility),
                       (SELECT count(*) FROM app_user WHERE active),
                       (SELECT count(*) FROM patient),
                       (SELECT count(*) FROM audit_event WHERE event_type = 'LOGIN' AND outcome = 'SUCCESS' AND occurred_at >= date_trunc('day', now())),
                       (SELECT count(*) FROM audit_event WHERE event_type = 'LOGIN' AND outcome = 'FAILED'  AND occurred_at >= date_trunc('day', now())),
                       (SELECT count(*) FROM audit_event WHERE event_type = 'RECORD_VIEW' AND occurred_at >= date_trunc('day', now()))
                """, (rs, i) -> new Stats(rs.getInt(1), rs.getInt(2), rs.getInt(3), rs.getInt(4), rs.getInt(5), rs.getInt(6)));

        // One row per person (their most recent session), counting only people active in the last
        // ACTIVE_MINUTES: a session left open in a closed browser stops counting as "signed in now" (DEF-010).
        List<ActiveSession> sessions = jdbc.query("""
                SELECT * FROM (
                    SELECT DISTINCT ON (u.user_id) u.username, u.full_name, u.role, f.name AS facility_name,
                           s.created_at, s.last_seen_at
                    FROM auth_session s
                    JOIN app_user u ON u.user_id = s.user_id
                    LEFT JOIN hospital_facility f ON f.facility_id = u.facility_id
                    WHERE s.ended_at IS NULL AND s.expires_at > now()
                      AND s.last_seen_at > now() - make_interval(mins => %d)
                    ORDER BY u.user_id, s.last_seen_at DESC
                ) latest ORDER BY last_seen_at DESC
                """.formatted(ACTIVE_MINUTES), (rs, i) -> new ActiveSession(rs.getString("username"), rs.getString("full_name"), rs.getString("role"),
                rs.getString("facility_name"), rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("last_seen_at", OffsetDateTime.class)));
        return new Overview(stats, sessions);
    }

    // ------------------------------------------------------------------ facilities / clinics

    @GetMapping("/facilities")
    public List<Facility> facilities(HttpServletRequest request) {
        CurrentUser.require(request, CurrentUser.ADMIN);
        return jdbc.query("""
                SELECT f.*,
                       (SELECT count(*) FROM app_user u WHERE u.facility_id = f.facility_id) AS user_count,
                       (SELECT count(DISTINCT m.patient_id) FROM master_patient_index m WHERE m.facility_id = f.facility_id) AS patient_count
                FROM hospital_facility f ORDER BY f.name
                """, (rs, i) -> new Facility(rs.getObject("facility_id", UUID.class), rs.getString("name"),
                rs.getString("short_name"), rs.getString("province"), rs.getString("connection_type"), rs.getString("status"),
                rs.getObject("onboarded_at", OffsetDateTime.class), rs.getObject("last_synced_at", OffsetDateTime.class),
                rs.getInt("user_count"), rs.getInt("patient_count")));
    }

    @PostMapping("/facilities")
    @ResponseStatus(HttpStatus.CREATED)
    public Facility createFacility(HttpServletRequest request, @Valid @RequestBody NewFacility body) {
        CurrentUser admin = CurrentUser.require(request, CurrentUser.ADMIN);
        String name = body.name().trim();
        Integer clash = jdbc.queryForObject("SELECT count(*) FROM hospital_facility WHERE lower(name) = lower(?)", Integer.class, name);
        if (clash != null && clash > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "A clinic with this name already exists.");

        UUID id = UUID.randomUUID();
        String shortName = name.replaceAll("(?i)\\s+(hospital|clinic)$", "");
        if (shortName.length() > 80) shortName = shortName.substring(0, 80);
        jdbc.update("""
                INSERT INTO hospital_facility (facility_id, name, short_name, province, connection_type, status, onboarded_at, last_synced_at)
                VALUES (?, ?, ?, ?, 'MANUAL_ENTRY', 'ACTIVE', now(), NULL)""", id, name, shortName, body.province().trim());
        audit.log(admin, "CLINIC_CREATED", null, name + " (" + body.province().trim() + ")", AuditService.SUCCESS);
        return facilities(request).stream().filter(f -> f.id().equals(id)).findFirst().orElseThrow();
    }

    // ------------------------------------------------------------------ users

    private static final String USER_SELECT = """
            SELECT u.user_id, u.username, u.full_name, u.role, u.facility_id, f.name AS facility_name,
                   u.active, u.created_at, u.last_login_at
            FROM app_user u LEFT JOIN hospital_facility f ON f.facility_id = u.facility_id
            """;

    private static User userRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new User(rs.getObject("user_id", UUID.class), rs.getString("username"), rs.getString("full_name"),
                rs.getString("role"), rs.getObject("facility_id", UUID.class), rs.getString("facility_name"),
                rs.getBoolean("active"), rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("last_login_at", OffsetDateTime.class));
    }

    @GetMapping("/users")
    public List<User> users(HttpServletRequest request) {
        CurrentUser.require(request, CurrentUser.ADMIN);
        return jdbc.query(USER_SELECT + " ORDER BY u.role, f.name NULLS FIRST, u.full_name", (rs, i) -> userRow(rs));
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public User createUser(HttpServletRequest request, @Valid @RequestBody NewUser body) {
        CurrentUser admin = CurrentUser.require(request, CurrentUser.ADMIN);
        String role = body.role().trim().toUpperCase();
        if (!List.of(CurrentUser.ADMIN, CurrentUser.CLINIC, CurrentUser.CLINICIAN).contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role must be Administrator, Clinic or Clinician.");
        }
        UUID facilityId = CurrentUser.ADMIN.equals(role) ? null : body.facilityId();
        if (!CurrentUser.ADMIN.equals(role)) {
            if (facilityId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose the clinic this account belongs to.");
            Integer exists = jdbc.queryForObject("SELECT count(*) FROM hospital_facility WHERE facility_id = ?", Integer.class, facilityId);
            if (exists == null || exists == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That clinic does not exist.");
        }
        String username = body.username().trim().toLowerCase();
        Integer clash = jdbc.queryForObject("SELECT count(*) FROM app_user WHERE username = ?", Integer.class, username);
        if (clash != null && clash > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "That username is already taken.");

        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role, facility_id) VALUES (?, ?, ?, ?, ?, ?)",
                id, username, auth.hash(body.password()), body.fullName().trim(), role, facilityId);
        User created = jdbc.queryForObject(USER_SELECT + " WHERE u.user_id = ?", (rs, i) -> userRow(rs), id);
        audit.log(admin, "USER_CREATED", null,
                created.fullName() + " (" + username + ", " + role.toLowerCase()
                        + (created.facilityName() != null ? ", " + created.facilityName() : "") + ")",
                AuditService.SUCCESS);
        return created;
    }

    @PatchMapping("/users/{userId}")
    public User setActive(HttpServletRequest request, @PathVariable UUID userId, @Valid @RequestBody UserStatus body) {
        CurrentUser admin = CurrentUser.require(request, CurrentUser.ADMIN);
        if (admin.id().equals(userId) && !body.active()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can't disable your own account.");
        }
        int updated = jdbc.update("UPDATE app_user SET active = ? WHERE user_id = ?", body.active(), userId);
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found.");
        if (!body.active()) auth.endAllSessions(userId);
        User user = jdbc.queryForObject(USER_SELECT + " WHERE u.user_id = ?", (rs, i) -> userRow(rs), userId);
        audit.log(admin, body.active() ? "USER_ENABLED" : "USER_DISABLED", null, user.fullName() + " (" + user.username() + ")", AuditService.SUCCESS);
        return user;
    }

    @PostMapping("/users/{userId}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(HttpServletRequest request, @PathVariable UUID userId, @Valid @RequestBody PasswordReset body) {
        CurrentUser admin = CurrentUser.require(request, CurrentUser.ADMIN);
        int updated = jdbc.update("UPDATE app_user SET password_hash = ? WHERE user_id = ?", auth.hash(body.password()), userId);
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found.");
        auth.endAllSessions(userId);
        String username = jdbc.queryForObject("SELECT username FROM app_user WHERE user_id = ?", String.class, userId);
        auth.clearSignInLock(username);   // a reset also lifts a sign-in lock-out (DEF-013)
        audit.log(admin, "PASSWORD_RESET", null, "Account: " + username, AuditService.SUCCESS);
    }

    // ------------------------------------------------------------------ updates sent in by clinicians / nurses

    @GetMapping("/updates")
    public List<za.nhiconnect.service.RecordEntryService.RecordUpdate> updates(HttpServletRequest request) {
        CurrentUser.require(request, CurrentUser.ADMIN);
        return entries.listUpdates(null, 100);
    }

    // ------------------------------------------------------------------ break-glass review (REQ-006)

    public record BreakGlassDecision(
            @NotBlank @Pattern(regexp = "JUSTIFIED|NOT_JUSTIFIED", message = "Decision must be JUSTIFIED or NOT_JUSTIFIED.") String decision,
            @Size(max = 500) String note) {}

    @GetMapping("/break-glass")
    public List<za.nhiconnect.service.ConsentService.BreakGlassEvent> breakGlass(HttpServletRequest request) {
        CurrentUser.require(request, CurrentUser.ADMIN);
        return consent.breakGlassEvents(200);
    }

    @PostMapping("/break-glass/{eventId}/review")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reviewBreakGlass(HttpServletRequest request, @PathVariable UUID eventId, @Valid @RequestBody BreakGlassDecision body) {
        consent.review(CurrentUser.require(request, CurrentUser.ADMIN), eventId, body.decision(), body.note());
    }

    // ------------------------------------------------------------------ audit trail

    @GetMapping("/audit")
    public List<AuditRow> audit(HttpServletRequest request,
                                @RequestParam(required = false) UUID facilityId,
                                @RequestParam(required = false) String eventType,
                                @RequestParam(required = false) String outcome,
                                @RequestParam(defaultValue = "300") int limit) {
        CurrentUser.require(request, CurrentUser.ADMIN);
        return queryAudit(jdbc, facilityId, eventType, outcome, limit);
    }

    /** Shared with the clinic portal, which sees only its own facility's events. */
    static List<AuditRow> queryAudit(JdbcTemplate jdbc, UUID facilityId, String eventType, String outcome, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT a.event_id, a.occurred_at, a.username, a.full_name, a.role, f.name AS facility_name,
                       a.event_type, p.first_name || ' ' || p.surname AS patient_name, a.target, a.outcome
                FROM audit_event a
                LEFT JOIN hospital_facility f ON f.facility_id = a.facility_id
                LEFT JOIN patient p ON p.patient_id = a.patient_id
                WHERE 1 = 1""");
        List<Object> args = new ArrayList<>();
        if (facilityId != null) { sql.append(" AND a.facility_id = ?"); args.add(facilityId); }
        if (eventType != null && !eventType.isBlank()) { sql.append(" AND a.event_type = ?"); args.add(eventType.trim().toUpperCase()); }
        if (outcome != null && !outcome.isBlank()) { sql.append(" AND a.outcome = ?"); args.add(outcome.trim().toUpperCase()); }
        sql.append(" ORDER BY a.occurred_at DESC LIMIT ?");
        args.add(Math.max(1, Math.min(limit, 1000)));
        return jdbc.query(sql.toString(), (rs, i) -> new AuditRow(rs.getObject("event_id", UUID.class),
                rs.getObject("occurred_at", OffsetDateTime.class), rs.getString("username"), rs.getString("full_name"),
                rs.getString("role"), rs.getString("facility_name"), rs.getString("event_type"),
                rs.getString("patient_name"), rs.getString("target"), rs.getString("outcome")), args.toArray());
    }
}
