package za.nhiconnect.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import za.nhiconnect.auth.AuditService;
import za.nhiconnect.auth.CurrentUser;
import za.nhiconnect.util.TestEquivalence;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.UUID;

/**
 * Clinical Decision Support duplicate-test check (REQ-004; Design §3.2.2 checkDuplicateTest).
 * Advisory only: the caller shows a warning and the clinician may still proceed.
 */
@Service
public class DecisionSupportService {

    private static final ZoneId SA = ZoneId.of("Africa/Johannesburg");

    public record PriorResult(String testName, LocalDate date, String facilityName, String value, long daysAgo) {}
    public record DuplicateCheck(boolean warning, int windowDays, PriorResult priorResult) {}

    private record Obs(String name, OffsetDateTime at, String facility, String value) {}

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public DecisionSupportService(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    public DuplicateCheck check(CurrentUser user, UUID patientId, String testName, LocalDate orderDate) {
        LocalDate when = orderDate == null ? LocalDate.now(SA) : orderDate;
        int window = TestEquivalence.windowDays(testName);
        var prior = jdbc.query("""
                SELECT o.display_name, o.observed_at, f.name AS facility, o.value
                FROM observation o JOIN hospital_facility f ON f.facility_id = o.facility_id
                WHERE o.patient_id = ?""",
                (rs, i) -> new Obs(rs.getString(1), rs.getObject(2, OffsetDateTime.class), rs.getString(3), rs.getString(4)), patientId)
            .stream()
            .filter(o -> TestEquivalence.sameTest(o.name(), testName))
            .filter(o -> {
                long days = ChronoUnit.DAYS.between(o.at().atZoneSameInstant(SA).toLocalDate(), when);
                return days >= 0 && days <= window;
            })
            .max(Comparator.comparing(Obs::at));

        if (prior.isEmpty()) return new DuplicateCheck(false, window, null);
        Obs o = prior.get();
        LocalDate date = o.at().atZoneSameInstant(SA).toLocalDate();
        long days = ChronoUnit.DAYS.between(date, when);
        audit.log(user, "DUPLICATE_TEST_WARNING", patientId,
                testName.trim() + " — equivalent result " + days + " day(s) earlier at " + o.facility(), AuditService.SUCCESS);
        return new DuplicateCheck(true, window, new PriorResult(o.name(), date, o.facility(), o.value(), days));
    }
}
