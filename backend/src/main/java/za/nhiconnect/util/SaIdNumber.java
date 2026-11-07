package za.nhiconnect.util;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Checks on South African ID numbers (format YYMMDD SSSS C A Z).
 * Used by the Master Patient Index's deterministic match and by manual patient intake.
 */
public final class SaIdNumber {

    private static final DateTimeFormatter YYMMDD = DateTimeFormatter.ofPattern("yyMMdd");

    private SaIdNumber() {}

    /** True if the value is exactly 13 digits. */
    public static boolean isWellFormed(String id) {
        return id != null && id.matches("\\d{13}");
    }

    /** True if the ID number's first six digits (YYMMDD) agree with the given date of birth. */
    public static boolean matchesDateOfBirth(String id, LocalDate dateOfBirth) {
        return isWellFormed(id) && dateOfBirth != null && id.startsWith(dateOfBirth.format(YYMMDD));
    }
}
