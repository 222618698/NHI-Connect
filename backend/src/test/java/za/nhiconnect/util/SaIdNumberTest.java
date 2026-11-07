package za.nhiconnect.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/** UT-01..UT-03: SA ID number rules used by the MPI and manual intake (REQ-002, REQ-003). */
class SaIdNumberTest {

    @ParameterizedTest(name = "{0} is well formed")
    @ValueSource(strings = {"8801015800083", "9509185412089", "7203150460080", "5811305129087", "0106220785088", "1509055401086"})
    @DisplayName("UT-01 all six demo dataset ID numbers are well formed")
    void demoIdsAreWellFormed(String id) {
        assertTrue(SaIdNumber.isWellFormed(id));
    }

    @ParameterizedTest(name = "\"{0}\" is rejected")
    @NullAndEmptySource
    @ValueSource(strings = {"880101580008", "88010158000830", "88010158000A3", "8801 15800083", "-801015800083"})
    @DisplayName("UT-02 malformed ID numbers are rejected")
    void malformedIdsAreRejected(String id) {
        assertFalse(SaIdNumber.isWellFormed(id));
    }

    @ParameterizedTest(name = "{0} matches {1}")
    @CsvSource({
            "8801015800083, 1988-01-01",
            "0106220785088, 2001-06-22",
            "1509055401086, 2015-09-05",
            "5811305129087, 1958-11-30"})
    @DisplayName("UT-03a ID number agrees with the patient's date of birth")
    void dobMatches(String id, LocalDate dob) {
        assertTrue(SaIdNumber.matchesDateOfBirth(id, dob));
    }

    @Test
    @DisplayName("UT-03b a date of birth that disagrees with the ID number is rejected")
    void dobMismatchRejected() {
        assertFalse(SaIdNumber.matchesDateOfBirth("8801015800083", LocalDate.of(1988, 1, 2)));
        assertFalse(SaIdNumber.matchesDateOfBirth("8801015800083", LocalDate.of(1989, 1, 1)));
        assertFalse(SaIdNumber.matchesDateOfBirth("8801015800083", null));
        assertFalse(SaIdNumber.matchesDateOfBirth("not-an-id", LocalDate.of(1988, 1, 1)));
    }
}
