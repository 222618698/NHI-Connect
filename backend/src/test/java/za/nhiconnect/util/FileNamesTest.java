package za.nhiconnect.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** UT-04: uploaded file names are made safe before storage (REQ-002, security). */
class FileNamesTest {

    @Test
    @DisplayName("UT-04a an ordinary file name is kept")
    void keepsOrdinaryName() {
        assertEquals("NHLS report (1).pdf", FileNames.clean("NHLS report (1).pdf", "pdf"));
    }

    @Test
    @DisplayName("UT-04b directory parts are stripped (path traversal)")
    void stripsDirectories() {
        assertEquals("passwd", FileNames.clean("../../etc/passwd", "txt"));
        assertEquals("report.pdf", FileNames.clean("C:\\Users\\nurse\\Desktop\\report.pdf", "pdf"));
    }

    @Test
    @DisplayName("UT-04c header-breaking and script characters are replaced")
    void replacesUnsafeCharacters() {
        String cleaned = FileNames.clean("a\"b;c<script>.pdf", "pdf");
        assertFalse(cleaned.contains("\"") || cleaned.contains(";") || cleaned.contains("<"), cleaned);
        assertTrue(cleaned.endsWith(".pdf"));
    }

    @Test
    @DisplayName("UT-04d empty, missing or hidden names fall back to document.<ext>")
    void fallsBack() {
        assertEquals("document.pdf", FileNames.clean(null, "pdf"));
        assertEquals("document.png", FileNames.clean("", "png"));
        assertEquals("document.txt", FileNames.clean(".bashrc", "txt"));
    }

    @Test
    @DisplayName("UT-04e names are capped at 200 characters")
    void capsLength() {
        assertEquals(200, FileNames.clean("x".repeat(500) + ".pdf", "pdf").length());
    }
}
