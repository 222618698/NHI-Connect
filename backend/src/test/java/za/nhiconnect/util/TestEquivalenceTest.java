package za.nhiconnect.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

/** UT-06, UT-07: duplicate-test matching rules used by Clinical Decision Support (REQ-004). */
class TestEquivalenceTest {

    @ParameterizedTest(name = "\"{0}\" ~ \"{1}\"")
    @CsvSource(delimiter = '|', value = {
            "FBC | Full Blood Count & CRP",
            "Full Blood Count | Full Blood Count",
            "full blood count | Routine Bloods: FBC",
            "HbA1c | HBA1C test",
            "Lipid Panel | lipid",
            "Glucose | Fasting Glucose & Lipogram",
            "Viral load | HIV Viral Load",
            "U&E | Urea & Electrolytes"})  // regression test for DEF-019
    @DisplayName("UT-06a equivalent test names match despite local naming")
    void equivalentNamesMatch(String a, String b) {
        assertTrue(TestEquivalence.sameTest(a, b));
        assertTrue(TestEquivalence.sameTest(b, a), "matching is symmetric");
    }

    @ParameterizedTest(name = "\"{0}\" !~ \"{1}\"")
    @CsvSource(delimiter = '|', value = {
            "Full Blood Count | Lipid Panel",
            "Troponin I | Troponin T (High-Sensitivity)",
            "HbA1c | Fasting Glucose",
            "' ' | Full Blood Count"})
    @DisplayName("UT-06b different tests do not match")
    void differentNamesDoNotMatch(String a, String b) {
        assertFalse(TestEquivalence.sameTest(a, b));
    }

    @Test
    @DisplayName("UT-07 equivalence windows follow the test type, with a 30-day default")
    void windows() {
        assertEquals(90, TestEquivalence.windowDays("HbA1c"));
        assertEquals(180, TestEquivalence.windowDays("Lipid Panel"));
        assertEquals(180, TestEquivalence.windowDays("HIV Viral Load"));
        assertEquals(30, TestEquivalence.windowDays("FBC"));
        assertEquals(1, TestEquivalence.windowDays("Troponin T (High-Sensitivity)"));
        assertEquals(TestEquivalence.DEFAULT_WINDOW_DAYS, TestEquivalence.windowDays("Peak Expiratory Flow"));
    }
}
