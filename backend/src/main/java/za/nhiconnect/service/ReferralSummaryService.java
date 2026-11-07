package za.nhiconnect.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import za.nhiconnect.auth.CurrentUser;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.nio.charset.CharsetEncoder;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * One-page-style referral summary PDF for handing a patient over between facilities (REQ-009).
 * Built from the same unified data the timeline uses; consent is checked by the caller.
 */
@Service
public class ReferralSummaryService {

    private static final ZoneId SA = ZoneId.of("Africa/Johannesburg");
    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");
    private static final Color NAVY = new Color(0x1f, 0x38, 0x64);
    private static final Color TEAL = new Color(0x0E, 0x7C, 0x86);
    private static final Color GREY = new Color(0x5b, 0x6b, 0x79);
    private static final Color TINT = new Color(0xee, 0xf2, 0xf7);

    private final JdbcTemplate jdbc;

    public ReferralSummaryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public byte[] build(CurrentUser by, UUID patientId) throws DocumentException {
        var patients = jdbc.queryForList("SELECT * FROM patient WHERE patient_id = ?", patientId);
        if (patients.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found.");
        Map<String, Object> p = patients.get(0);

        var meds = jdbc.queryForList("""
                SELECT m.display_name, m.dosage, m.start_date, f.name AS facility FROM medication m
                JOIN hospital_facility f ON f.facility_id = m.facility_id
                WHERE m.patient_id = ? AND (m.end_date IS NULL OR m.end_date >= current_date) ORDER BY m.start_date DESC""", patientId);
        var labs = jdbc.queryForList("""
                SELECT o.display_name, o.value, o.unit, o.observed_at, f.name AS facility FROM observation o
                JOIN hospital_facility f ON f.facility_id = o.facility_id
                WHERE o.patient_id = ? ORDER BY o.observed_at DESC LIMIT 8""", patientId);
        var encounters = jdbc.queryForList("""
                SELECT e.title, e.notes, e.admission_date, f.name AS facility, f.province FROM encounter e
                JOIN hospital_facility f ON f.facility_id = e.facility_id
                WHERE e.patient_id = ? ORDER BY e.admission_date DESC""", patientId);
        var docs = jdbc.queryForList("""
                SELECT d.file_name, d.description, d.uploaded_at, f.name AS facility FROM patient_document d
                JOIN hospital_facility f ON f.facility_id = d.facility_id
                WHERE d.patient_id = ? ORDER BY d.uploaded_at DESC""", patientId);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 42, 42, 40, 40);
        PdfWriter.getInstance(doc, out);
        doc.addTitle("NHI-Connect Referral Summary");
        doc.addCreator("NHI-Connect");
        doc.open();

        doc.add(para("NHI-CONNECT  ·  REFERRAL SUMMARY", font(FontFactory.HELVETICA_BOLD, 9, TEAL), 2));
        doc.add(para(p.get("first_name") + " " + p.get("surname"), font(FontFactory.HELVETICA_BOLD, 18, NAVY), 2));
        doc.add(para("SA ID " + p.get("national_id") + "     DOB " + p.get("date_of_birth") + "     Sex " + p.get("sex"),
                font(FontFactory.HELVETICA, 10, GREY), 2));
        doc.add(para("Generated " + OffsetDateTime.now(SA).format(DT) + " by " + by.fullName()
                + (by.facilityName() != null ? " (" + by.facilityName() + ")" : ""), font(FontFactory.HELVETICA_OBLIQUE, 8.5f, GREY), 10));

        section(doc, "Current medication");
        if (meds.isEmpty()) note(doc, "No current medication on record.");
        else table(doc, new float[]{3, 4, 2, 3}, List.of("Medication", "Dosage", "Since", "Prescribed at"),
                meds.stream().map(m -> List.of(str(m.get("display_name")), str(m.get("dosage")), date(m.get("start_date")), str(m.get("facility")))).toList());

        section(doc, "Recent results (latest " + labs.size() + ")");
        if (labs.isEmpty()) note(doc, "No laboratory results on record.");
        else table(doc, new float[]{3, 5, 2, 3}, List.of("Test", "Result", "Date", "Facility"),
                labs.stream().map(l -> List.of(str(l.get("display_name")),
                        str(l.get("value")) + (l.get("unit") != null ? " " + l.get("unit") : ""), date(l.get("observed_at")), str(l.get("facility")))).toList());

        section(doc, "Encounter history (" + encounters.size() + ")");
        if (encounters.isEmpty()) note(doc, "No encounters on record.");
        else table(doc, new float[]{2, 8, 3}, List.of("Date", "Encounter", "Facility"),
                encounters.stream().map(e -> List.of(date(e.get("admission_date")),
                        str(e.get("title")) + (e.get("notes") != null ? "\n" + truncate(str(e.get("notes")), 320) : ""),
                        e.get("facility") + "\n" + e.get("province"))).toList());

        section(doc, "Documents on file (" + docs.size() + ")");
        if (docs.isEmpty()) note(doc, "No documents uploaded.");
        else table(doc, new float[]{4, 5, 2, 3}, List.of("File", "Description", "Uploaded", "Facility"),
                docs.stream().map(d -> List.of(str(d.get("file_name")), str(d.get("description")), date(d.get("uploaded_at")), str(d.get("facility")))).toList());

        doc.add(para(" ", font(FontFactory.HELVETICA, 6, GREY), 0));
        doc.add(para("Not all facilities nationwide are connected to NHI-Connect yet; this summary reflects only onboarded and synced "
                + "hospitals. Confidential patient information (POPIA): share only with the receiving clinician.",
                font(FontFactory.HELVETICA_OBLIQUE, 8, GREY), 0));
        doc.close();
        return out.toByteArray();
    }

    // ---------------------------------------------------------------- PDF helpers

    private static Font font(String name, float size, Color colour) {
        return FontFactory.getFont(name, size, colour);
    }

    private static Paragraph para(String text, Font f, float after) {
        Paragraph p = new Paragraph(pdfSafe(text), f);
        p.setSpacingAfter(after);
        return p;
    }

    private static void section(Document doc, String title) throws DocumentException {
        Paragraph p = para(title, font(FontFactory.HELVETICA_BOLD, 11.5f, NAVY), 4);
        p.setSpacingBefore(8);
        doc.add(p);
    }

    private static void note(Document doc, String text) throws DocumentException {
        doc.add(para(text, font(FontFactory.HELVETICA_OBLIQUE, 9, GREY), 4));
    }

    private static void table(Document doc, float[] widths, List<String> headers, List<List<String>> rows) throws DocumentException {
        PdfPTable t = new PdfPTable(widths);
        t.setWidthPercentage(100);
        t.setHeaderRows(1);
        for (String h : headers) {
            PdfPCell c = new PdfPCell(new Phrase(pdfSafe(h), font(FontFactory.HELVETICA_BOLD, 8.5f, Color.WHITE)));
            c.setBackgroundColor(NAVY);
            c.setPadding(4);
            t.addCell(c);
        }
        boolean shade = false;
        for (List<String> row : rows) {
            for (String v : row) {
                PdfPCell c = new PdfPCell(new Phrase(pdfSafe(v), font(FontFactory.HELVETICA, 8.5f, Color.BLACK)));
                c.setPadding(4);
                if (shade) c.setBackgroundColor(TINT);
                t.addCell(c);
            }
            shade = !shade;
        }
        doc.add(t);
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    private static String date(Object o) {
        if (o == null) return "";
        if (o instanceof java.sql.Date d) return d.toLocalDate().format(D);
        if (o instanceof LocalDate d) return d.format(D);
        if (o instanceof java.sql.Timestamp ts) return ts.toInstant().atZone(SA).toLocalDate().format(D);
        if (o instanceof OffsetDateTime odt) return odt.atZoneSameInstant(SA).toLocalDate().format(D);
        return o.toString();
    }

    /** The built-in PDF fonts use Windows-1252; replace characters they cannot draw (e.g. superscripts). */
    static String pdfSafe(String s) {
        if (s == null) return "";
        CharsetEncoder enc = Charset.forName("windows-1252").newEncoder();
        StringBuilder b = new StringBuilder(s.length());
        for (char ch : s.replace("⁹", "^9").replace("≤", "<=").replace("≥", ">=").toCharArray()) {
            b.append(enc.canEncode(ch) ? ch : '?');
        }
        return b.toString();
    }
}
