package za.nhiconnect.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** UT-05: which accounts may sign in under each "Sign in as" option (REQ-012, Security Layer RBAC). */
class SignInRoleRuleTest {

    @Test
    @DisplayName("UT-05a 'Clinician / Nurse' admits clinicians and clinic staff only")
    void clinicianChoice() {
        assertTrue(AuthService.isAllowedForChoice("CLINICIAN", CurrentUser.CLINICIAN));
        assertTrue(AuthService.isAllowedForChoice("CLINICIAN", CurrentUser.CLINIC));
        assertFalse(AuthService.isAllowedForChoice("CLINICIAN", CurrentUser.ADMIN));
    }

    @Test
    @DisplayName("UT-05b 'Administrator' admits administrators only")
    void adminChoice() {
        assertTrue(AuthService.isAllowedForChoice("ADMIN", CurrentUser.ADMIN));
        assertFalse(AuthService.isAllowedForChoice("ADMIN", CurrentUser.CLINICIAN));
        assertFalse(AuthService.isAllowedForChoice("ADMIN", CurrentUser.CLINIC));
    }

    @Test
    @DisplayName("UT-05c unknown or missing choices admit nobody")
    void unknownChoice() {
        assertFalse(AuthService.isAllowedForChoice("SUPERUSER", CurrentUser.ADMIN));
        assertFalse(AuthService.isAllowedForChoice(null, CurrentUser.ADMIN));
        assertTrue(AuthService.isAllowedForChoice(" admin ", CurrentUser.ADMIN), "choice is trimmed and case-insensitive");
    }
}
