package za.nhiconnect.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Creates the demo accounts the first time the app starts with an empty user table (DEF-012).
 * No password is kept in the source code: each one is read from an environment variable, and an account whose
 * variable is not set is simply not created (a warning is logged). Passwords are hashed with BCrypt before storage.
 * <pre>
 *   NHI_DEMO_ADMIN_PASSWORD      → admin
 *   NHI_DEMO_CLINIC_PASSWORD     → braamfontein.clinic
 *   NHI_DEMO_CLINICIAN_PASSWORD  → t.moloi and a.khumalo
 * </pre>
 */
@Component
public class DemoUserSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoUserSeeder.class);

    private static final String BRAAMFONTEIN = "11111111-0000-0000-0000-000000000001";
    private static final String UMHLANGA = "11111111-0000-0000-0000-000000000003";
    static final int MIN_LENGTH = 8;

    private final JdbcTemplate jdbc;
    private final AuthService auth;
    private final String adminPassword;
    private final String clinicPassword;
    private final String clinicianPassword;

    public DemoUserSeeder(JdbcTemplate jdbc, AuthService auth,
                          @Value("${NHI_DEMO_ADMIN_PASSWORD:}") String adminPassword,
                          @Value("${NHI_DEMO_CLINIC_PASSWORD:}") String clinicPassword,
                          @Value("${NHI_DEMO_CLINICIAN_PASSWORD:}") String clinicianPassword) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.adminPassword = adminPassword;
        this.clinicPassword = clinicPassword;
        this.clinicianPassword = clinicianPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM app_user", Integer.class);
        if (count != null && count > 0) return;

        List<String> created = new ArrayList<>();
        create(created, "admin", adminPassword, "NHI_DEMO_ADMIN_PASSWORD", "System Administrator", CurrentUser.ADMIN, null);
        create(created, "braamfontein.clinic", clinicPassword, "NHI_DEMO_CLINIC_PASSWORD", "Braamfontein Records Office", CurrentUser.CLINIC, BRAAMFONTEIN);
        create(created, "t.moloi", clinicianPassword, "NHI_DEMO_CLINICIAN_PASSWORD", "Dr T. Moloi", CurrentUser.CLINICIAN, BRAAMFONTEIN);
        create(created, "a.khumalo", clinicianPassword, "NHI_DEMO_CLINICIAN_PASSWORD", "Dr A. Khumalo", CurrentUser.CLINICIAN, UMHLANGA);
        if (!created.isEmpty()) log.info("Created demo accounts: {}", String.join(" / ", created));
    }

    /** True if a configured password is usable (set and at least {@value #MIN_LENGTH} characters). */
    static boolean usable(String password) {
        return password != null && password.strip().length() >= MIN_LENGTH;
    }

    private void create(List<String> created, String username, String password, String variable,
                        String fullName, String role, String facilityId) {
        if (!usable(password)) {
            log.warn("Demo account '{}' not created: set the environment variable {} (at least {} characters).",
                    username, variable, MIN_LENGTH);
            return;
        }
        jdbc.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role, facility_id) VALUES (?, ?, ?, ?, ?, ?)",
                UUID.randomUUID(), username, auth.hash(password.strip()), fullName, role,
                facilityId == null ? null : UUID.fromString(facilityId));
        created.add(username);
    }
}
