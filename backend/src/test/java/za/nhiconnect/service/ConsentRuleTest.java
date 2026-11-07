package za.nhiconnect.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** UT-08: the consent access rule (REQ-006; Design §3.2.2 checkAccess) and PDF text safety (REQ-009). */
class ConsentRuleTest {

    private static final UUID BRAAMFONTEIN = UUID.randomUUID();
    private static final UUID UMHLANGA = UUID.randomUUID();
    private static final UUID TABLE_BAY = UUID.randomUUID();

    @Test
    @DisplayName("UT-08a 'hide from all other facilities' blocks everyone except the recording clinic")
    void allOthers() {
        assertFalse(ConsentService.excludes(BRAAMFONTEIN, null, BRAAMFONTEIN));
        assertTrue(ConsentService.excludes(BRAAMFONTEIN, null, UMHLANGA));
        assertTrue(ConsentService.excludes(BRAAMFONTEIN, null, TABLE_BAY));
    }

    @Test
    @DisplayName("UT-08b a facility-specific restriction blocks only that facility")
    void specificFacility() {
        assertTrue(ConsentService.excludes(BRAAMFONTEIN, UMHLANGA, UMHLANGA));
        assertFalse(ConsentService.excludes(BRAAMFONTEIN, UMHLANGA, TABLE_BAY));
        assertFalse(ConsentService.excludes(BRAAMFONTEIN, UMHLANGA, BRAAMFONTEIN));
    }

    @Test
    @DisplayName("UT-08c users without a facility are always excluded")
    void noFacility() {
        assertTrue(ConsentService.excludes(BRAAMFONTEIN, UMHLANGA, null));
        assertTrue(ConsentService.excludes(BRAAMFONTEIN, null, null));
    }

    @Test
    @DisplayName("UT-09 referral PDF text: characters the PDF fonts cannot draw are replaced, others kept")
    void pdfSafe() {
        assertEquals("WCC 14.2 x10^9/L — raised, CD4 210 cells/µL", ReferralSummaryService.pdfSafe("WCC 14.2 x10⁹/L — raised, CD4 210 cells/µL"));
        assertEquals("LDL <= 1.8", ReferralSummaryService.pdfSafe("LDL ≤ 1.8"));
        assertEquals("", ReferralSummaryService.pdfSafe(null));
    }
}
