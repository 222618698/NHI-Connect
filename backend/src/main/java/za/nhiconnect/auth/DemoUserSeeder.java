package za.nhiconnect.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Creates the demo accounts the first time the app starts with an empty user table.
 * Passwords are hashed here (not stored in SQL) so no hash ever lives in the repo.
 * Change these passwords before using the system with real data.
 */
@Component
public class DemoUserSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoUserSeeder.class);

    private static final String BRAAMFONTEIN = "11111111-0000-0000-0000-000000000001";
    private static final String UMHLANGA = "11111111-0000-0000-0000-000000000003";

    private final JdbcTemplate jdbc;
    private final AuthService auth;

    public DemoUserSeeder(JdbcTemplate jdbc, AuthService auth) {
        this.jdbc = jdbc;
        this.auth = auth;
    }

    @Override
    public void run(ApplicationArguments args) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM app_user", Integer.class);
        if (count != null && count > 0) return;

        create("admin", "Admin@123", "System Administrator", CurrentUser.ADMIN, null);
        create("braamfontein.clinic", "Clinic@123", "Braamfontein Records Office", CurrentUser.CLINIC, BRAAMFONTEIN);
        create("t.moloi", "Clinician@123", "Dr T. Moloi", CurrentUser.CLINICIAN, BRAAMFONTEIN);
        create("a.khumalo", "Clinician@123", "Dr A. Khumalo", CurrentUser.CLINICIAN, UMHLANGA);
        log.info("Created demo accounts: admin / braamfontein.clinic / t.moloi / a.khumalo");
    }

    private void create(String username, String password, String fullName, String role, String facilityId) {
        jdbc.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role, facility_id) VALUES (?, ?, ?, ?, ?, ?)",
                UUID.randomUUID(), username, auth.hash(password), fullName, role,
                facilityId == null ? null : UUID.fromString(facilityId));
    }
}
