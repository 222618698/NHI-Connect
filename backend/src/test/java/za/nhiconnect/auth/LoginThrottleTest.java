package za.nhiconnect.auth;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

/** DEF-013: temporary lock-out after repeated failed sign-ins. */
class LoginThrottleTest {

    /** A clock the test can move forward. */
    static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-07T08:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final TestClock clock = new TestClock();
    private final LoginThrottle throttle = new LoginThrottle(5, Duration.ofMinutes(15), clock);

    @Test
    void locksAfterTheFifthConsecutiveFailure() {
        for (int i = 1; i <= 4; i++) {
            assertFalse(throttle.recordFailure("t.moloi"), "failure " + i + " must not lock");
            assertTrue(throttle.lockedFor("t.moloi").isEmpty());
        }
        assertTrue(throttle.recordFailure("t.moloi"), "fifth failure locks");
        assertEquals(Duration.ofMinutes(15), throttle.lockedFor("t.moloi").orElseThrow());
    }

    @Test
    void lockExpiresAfterTheLockoutPeriodAndCountingStartsAgain() {
        for (int i = 0; i < 5; i++) throttle.recordFailure("admin");
        clock.advance(Duration.ofMinutes(14));
        assertEquals(Duration.ofMinutes(1), throttle.lockedFor("admin").orElseThrow());
        clock.advance(Duration.ofMinutes(1));
        assertTrue(throttle.lockedFor("admin").isEmpty(), "lock lifted after 15 minutes");
        assertFalse(throttle.recordFailure("admin"), "one new failure after expiry does not re-lock");
    }

    @Test
    void successfulSignInOrPasswordResetClearsTheCount() {
        for (int i = 0; i < 4; i++) throttle.recordFailure("a.khumalo");
        throttle.reset("a.khumalo");
        assertFalse(throttle.recordFailure("a.khumalo"), "count restarted after reset");
        for (int i = 0; i < 5; i++) throttle.recordFailure("kh.clinic");
        throttle.reset("kh.clinic");
        assertTrue(throttle.lockedFor("kh.clinic").isEmpty(), "reset lifts an active lock");
    }

    @Test
    void usernamesAreCountedSeparately() {
        for (int i = 0; i < 5; i++) throttle.recordFailure("attacker.target");
        assertTrue(throttle.lockedFor("attacker.target").isPresent());
        assertTrue(throttle.lockedFor("t.moloi").isEmpty(), "another user is unaffected");
    }

    @Test
    void oldFailuresDoNotAccumulateIntoALock() {
        for (int i = 0; i < 4; i++) throttle.recordFailure("braamfontein.clinic");
        clock.advance(Duration.ofMinutes(16));
        assertFalse(throttle.recordFailure("braamfontein.clinic"), "failures older than 15 minutes are forgotten");
    }

    @Test
    void rejectsANonPositiveLimit() {
        assertThrows(IllegalArgumentException.class, () -> new LoginThrottle(0, Duration.ofMinutes(15), clock));
    }
}
