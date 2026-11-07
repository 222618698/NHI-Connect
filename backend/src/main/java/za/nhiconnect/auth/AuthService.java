package za.nhiconnect.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Username/password sign-in backed by opaque, server-side session tokens. */
@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    // Compared against when the username doesn't exist, so a wrong username takes as long as a wrong password.
    private static final String DUMMY_HASH = new BCryptPasswordEncoder().encode("not-a-real-password");

    private static final String USER_SELECT = """
            SELECT u.user_id, u.username, u.full_name, u.role, u.facility_id, f.name AS facility_name
            FROM app_user u LEFT JOIN hospital_facility f ON f.facility_id = u.facility_id
            """;

    static final RowMapper<CurrentUser> USER_ROW = (rs, i) -> new CurrentUser(
            rs.getObject("user_id", UUID.class),
            rs.getString("username"),
            rs.getString("full_name"),
            rs.getString("role"),
            rs.getObject("facility_id", UUID.class),
            rs.getString("facility_name"));

    public record LoginResult(String token, CurrentUser user) {}

    private final JdbcTemplate jdbc;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final AuditService audit;
    private final int sessionHours;

    public AuthService(JdbcTemplate jdbc, AuditService audit, @Value("${nhi.auth.session-hours:8}") int sessionHours) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.sessionHours = sessionHours;
    }

    public String hash(String rawPassword) {
        return encoder.encode(rawPassword);
    }

    /**
     * The sign-in page has two buttons. "Clinician / Nurse" covers everyone working at a clinic (clinicians, nurses
     * and clinic staff); the account itself then decides which dashboard opens. "Administrator" is admins only.
     */
    private static final Map<String, java.util.Set<String>> ALLOWED_FOR_CHOICE = Map.of(
            CurrentUser.CLINICIAN, java.util.Set.of(CurrentUser.CLINICIAN, CurrentUser.CLINIC),
            CurrentUser.CLINIC, java.util.Set.of(CurrentUser.CLINIC),
            CurrentUser.ADMIN, java.util.Set.of(CurrentUser.ADMIN));
    /** True if an account with {@code role} may sign in under the "Sign in as" {@code choice}. */
    static boolean isAllowedForChoice(String choice, String role) {
        return choice != null && ALLOWED_FOR_CHOICE.getOrDefault(choice.trim().toUpperCase(), java.util.Set.of()).contains(role);
    }

    private static final Map<String, String> PORTAL_LABEL = Map.of(
            CurrentUser.ADMIN, "Administrator", CurrentUser.CLINIC, "Clinic", CurrentUser.CLINICIAN, "Clinician / Nurse");

    /**
     * @param expectedRole the "Sign in as" choice (CLINICIAN or ADMIN), or null to skip the check.
     * @throws ResponseStatusException 401 if the password is right but the account doesn't belong under that choice.
     */
    public Optional<LoginResult> login(String username, String password, String expectedRole) {
        String normalised = username == null ? "" : username.trim().toLowerCase();
        var rows = jdbc.queryForList("SELECT user_id, password_hash, active, role FROM app_user WHERE username = ?", normalised);

        boolean ok;
        if (rows.isEmpty()) {
            encoder.matches(password == null ? "" : password, DUMMY_HASH);
            ok = false;
        } else {
            var row = rows.get(0);
            ok = encoder.matches(password == null ? "" : password, (String) row.get("password_hash"))
                    && Boolean.TRUE.equals(row.get("active"));
        }

        if (!ok) {
            audit.logAnonymous(normalised, "LOGIN", "Username: " + normalised, AuditService.FAILED);
            return Optional.empty();
        }

        String actualRole = (String) rows.get(0).get("role");
        if (expectedRole != null && !expectedRole.isBlank()) {
            String choice = expectedRole.trim().toUpperCase();
            if (!isAllowedForChoice(choice, actualRole)) {
                audit.logAnonymous(normalised, "LOGIN", "Wrong \"Sign in as\" option: " + PORTAL_LABEL.getOrDefault(choice, choice), AuditService.FAILED);
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "This account can't sign in as " + PORTAL_LABEL.getOrDefault(choice, choice)
                                + ". Choose the correct \"Sign in as\" option.");
            }
        }

        UUID userId = (UUID) rows.get(0).get("user_id");
        String token = newToken();
        jdbc.update("INSERT INTO auth_session (token, user_id, expires_at) VALUES (?, ?, ?)",
                token, userId, OffsetDateTime.now().plusHours(sessionHours));
        jdbc.update("UPDATE app_user SET last_login_at = now() WHERE user_id = ?", userId);

        CurrentUser user = findUser(userId).orElseThrow();
        audit.log(user, "LOGIN", null, "Signed in", AuditService.SUCCESS);
        return Optional.of(new LoginResult(token, user));
    }

    /** Resolves a bearer token to its user, if the session is still open and the account still active. */
    public Optional<CurrentUser> resolve(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        var users = jdbc.query(USER_SELECT + """
                JOIN auth_session s ON s.user_id = u.user_id
                WHERE s.token = ? AND s.ended_at IS NULL AND s.expires_at > now() AND u.active
                """, USER_ROW, token);
        if (users.isEmpty()) return Optional.empty();
        jdbc.update("UPDATE auth_session SET last_seen_at = now() WHERE token = ?", token);
        return Optional.of(users.get(0));
    }

    public void logout(String token, CurrentUser user) {
        jdbc.update("UPDATE auth_session SET ended_at = now() WHERE token = ? AND ended_at IS NULL", token);
        audit.log(user, "LOGOUT", null, "Signed out", AuditService.SUCCESS);
    }

    /** Ends every open session for a user, e.g. when an admin disables the account. */
    public void endAllSessions(UUID userId) {
        jdbc.update("UPDATE auth_session SET ended_at = now() WHERE user_id = ? AND ended_at IS NULL", userId);
    }

    public Optional<CurrentUser> findUser(UUID userId) {
        return jdbc.query(USER_SELECT + " WHERE u.user_id = ?", USER_ROW, userId).stream().findFirst();
    }

    private static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
