package za.nhiconnect.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Temporary lock-out after repeated failed sign-ins for the same username (DEF-013; NIST SP 800-63B §5.2.2).
 * After {@code maxFailures} consecutive failures the username is locked for {@code lockout}; a successful sign-in
 * or an administrator's password reset clears the count. Kept in memory: a restart clears all locks.
 */
public class LoginThrottle {

    /** Upper bound on tracked usernames, so guessing many random names cannot exhaust memory. */
    static final int MAX_TRACKED = 10_000;

    private record Attempts(int failures, Instant lockedUntil, Instant lastFailure) {}

    private final Map<String, Attempts> byUser = new ConcurrentHashMap<>();
    private final int maxFailures;
    private final Duration lockout;
    private final Clock clock;

    public LoginThrottle(int maxFailures, Duration lockout, Clock clock) {
        if (maxFailures < 1) throw new IllegalArgumentException("maxFailures must be at least 1");
        this.maxFailures = maxFailures;
        this.lockout = lockout;
        this.clock = clock;
    }

    /** If the username is locked, how long until it may try again. */
    public Optional<Duration> lockedFor(String username) {
        Attempts a = byUser.get(username);
        if (a == null || a.lockedUntil() == null) return Optional.empty();
        Duration left = Duration.between(clock.instant(), a.lockedUntil());
        if (left.isNegative() || left.isZero()) {
            byUser.remove(username, a);   // lock expired: start counting afresh
            return Optional.empty();
        }
        return Optional.of(left);
    }

    /** Records a failed attempt; returns true if this failure has just locked the username. */
    public boolean recordFailure(String username) {
        Instant now = clock.instant();
        if (byUser.size() >= MAX_TRACKED) prune(now);
        Attempts after = byUser.compute(username, (k, a) -> {
            // Start afresh after an expired lock, or when the previous failure is older than the lock-out period.
            boolean fresh = a == null || a.lockedUntil() != null || a.lastFailure().plus(lockout).isBefore(now);
            int failures = fresh ? 1 : a.failures() + 1;
            Instant lockedUntil = failures >= maxFailures ? now.plus(lockout) : null;
            return new Attempts(failures, lockedUntil, now);
        });
        return after.lockedUntil() != null;
    }

    /** Clears the count after a successful sign-in or an administrator password reset. */
    public void reset(String username) {
        byUser.remove(username);
    }

    int maxFailures() {
        return maxFailures;
    }

    /** Drops expired locks and failure counts older than the lock-out period. */
    private void prune(Instant now) {
        byUser.entrySet().removeIf(e -> {
            Attempts a = e.getValue();
            return a.lockedUntil() != null ? !a.lockedUntil().isAfter(now) : a.lastFailure().plus(lockout).isBefore(now);
        });
    }
}
