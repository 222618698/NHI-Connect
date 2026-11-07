package za.nhiconnect.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** DEF-012: demo accounts are created only from a configured password of at least 8 characters. */
class DemoPasswordRuleTest {

    @Test
    void missingOrShortPasswordsAreNotUsed() {
        assertFalse(DemoUserSeeder.usable(null), "variable not set");
        assertFalse(DemoUserSeeder.usable(""), "variable set but empty");
        assertFalse(DemoUserSeeder.usable("   "), "only spaces");
        assertFalse(DemoUserSeeder.usable("short7!"), "7 characters");
    }

    @Test
    void passwordsOfEightOrMoreCharactersAreUsed() {
        assertTrue(DemoUserSeeder.usable("eight888"));
        assertTrue(DemoUserSeeder.usable("  a-longer passphrase  "));
    }
}
