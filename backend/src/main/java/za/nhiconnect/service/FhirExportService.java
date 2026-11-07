package za.nhiconnect.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

/**
 * Exports a patient's unified record as an HL7 FHIR R4 Bundle (REQ-005), in two tiers (Design §3.2.1):
 * <ul>
 *   <li><b>full</b> — Patient, Organization, Encounter (with clinical-notes narrative), Observation,
 *       MedicationStatement and DocumentReference, every reference resolvable inside the bundle;</li>
 *   <li><b>lite</b> — for low-bandwidth facilities (REQ-008): only Patient, Encounter, Observation and
 *       MedicationStatement with their required/essential elements; no narratives, organisations or document
 *       metadata. Facilities are carried as reference display names.</li>
 * </ul>
 * Built directly as JSON-ready maps (no HAPI FHIR dependency yet); structural checks are in the integration tests.
 */
@Service
public class FhirExportService {

    public static final String BASE = "https://nhi-connect.local/fhir";
    /** Illustrative identifier system for the South African ID number (no official URI was available). */
    public static final String SA_ID_SYSTEM = "https://nhi-connect.local/fhir/sid/za-id";
    private static final String PROFILE = "https://nhi-connect.local/fhir/StructureDefinition/";
    private static final ZoneId SA = ZoneId.of("Africa/Johannesburg");

    private final JdbcTemplate jdbc;

    public FhirExportService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> everything(UUID patientId, boolean lite) {
        var rows = jdbc.queryForList("SELECT * FROM patient WHERE patient_id = ?", patientId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found.");
        Map<String, Object> p = rows.get(0);
        String pid = patientId.toString();
        String tier = lite ? "lite" : "full";
        List<Map<String, Object>> entries = new ArrayList<>();
        Map<String, String> orgNames = new LinkedHashMap<>();

        // Patient
        Map<String, Object> patient = resource("Patient", pid, tier);
        patient.put("identifier", List.of(Map.of("system", SA_ID_SYSTEM, "value", p.get("national_id"))));
        patient.put("name", List.of(Map.of("family", p.get("surname"), "given", List.of(((String) p.get("first_name")).split(" ")))));
        patient.put("gender", ((String) p.get("sex")).toLowerCase(Locale.ROOT));
        patient.put("birthDate", p.get("date_of_birth").toString());
        if (!lite) narrative(patient, p.get("first_name") + " " + p.get("surname") + ", born " + p.get("date_of_birth"));
        entries.add(entry(patient));

        // Encounters
        for (var e : jdbc.queryForList("""
                SELECT e.*, f.name AS facility FROM encounter e JOIN hospital_facility f ON f.facility_id = e.facility_id
                WHERE e.patient_id = ? ORDER BY e.admission_date""", patientId)) {
            String fid = e.get("facility_id").toString();
            orgNames.put(fid, (String) e.get("facility"));
            Map<String, Object> r = resource("Encounter", e.get("encounter_id").toString(), tier);
            r.put("status", "finished");
            r.put("class", encounterClass((String) e.get("encounter_type")));
            r.put("type", List.of(Map.of("text", e.get("title"))));
            r.put("subject", ref("Patient", pid, null));
            Map<String, Object> period = new LinkedHashMap<>();
            period.put("start", iso(e.get("admission_date")));
            if (e.get("discharge_date") != null) period.put("end", iso(e.get("discharge_date")));
            r.put("period", period);
            r.put("serviceProvider", ref("Organization", fid, (String) e.get("facility"), lite));
            if (!lite && e.get("notes") != null) narrative(r, (String) e.get("notes"));
            entries.add(entry(r));
        }

        // Observations (laboratory results)
        for (var o : jdbc.queryForList("""
                SELECT o.*, f.name AS facility FROM observation o JOIN hospital_facility f ON f.facility_id = o.facility_id
                WHERE o.patient_id = ? ORDER BY o.observed_at""", patientId)) {
            String fid = o.get("facility_id").toString();
            orgNames.put(fid, (String) o.get("facility"));
            Map<String, Object> r = resource("Observation", o.get("observation_id").toString(), tier);
            r.put("status", "final");
            r.put("category", List.of(Map.of("coding", List.of(Map.of(
                    "system", "http://terminology.hl7.org/CodeSystem/observation-category", "code", "laboratory")))));
            r.put("code", codeable((String) o.get("code_standard"), (String) o.get("code_local"), (String) o.get("display_name"), lite));
            r.put("subject", ref("Patient", pid, null));
            if (o.get("encounter_id") != null && !lite) r.put("encounter", ref("Encounter", o.get("encounter_id").toString(), null));
            r.put("effectiveDateTime", iso(o.get("observed_at")));
            r.put("valueString", o.get("value") + (o.get("unit") != null ? " " + o.get("unit") : ""));
            r.put("performer", List.of(ref("Organization", fid, (String) o.get("facility"), lite)));
            entries.add(entry(r));
        }

        // Medications
        for (var m : jdbc.queryForList("""
                SELECT m.*, f.name AS facility FROM medication m JOIN hospital_facility f ON f.facility_id = m.facility_id
                WHERE m.patient_id = ? ORDER BY m.start_date""", patientId)) {
            String fid = m.get("facility_id").toString();
            orgNames.put(fid, (String) m.get("facility"));
            Map<String, Object> r = resource("MedicationStatement", m.get("medication_id").toString(), tier);
            LocalDate end = m.get("end_date") == null ? null : ((java.sql.Date) m.get("end_date")).toLocalDate();
            r.put("status", end != null && end.isBefore(LocalDate.now(SA)) ? "completed" : "active");
            r.put("medicationCodeableConcept", codeable((String) m.get("code_standard"), (String) m.get("code_local"), (String) m.get("display_name"), lite));
            r.put("subject", ref("Patient", pid, null));
            Map<String, Object> period = new LinkedHashMap<>();
            period.put("start", m.get("start_date").toString());
            if (end != null) period.put("end", end.toString());
            r.put("effectivePeriod", period);
            if (m.get("dosage") != null) r.put("dosage", List.of(Map.of("text", m.get("dosage"))));
            r.put("informationSource", ref("Organization", fid, (String) m.get("facility"), lite));
            entries.add(entry(r));
        }

        if (!lite) {
            // Documents: metadata + a link to the content (the bytes are fetched separately).
            for (var d : jdbc.queryForList("""
                    SELECT d.document_id, d.facility_id, d.file_name, d.content_type, d.size_bytes, d.description, d.uploaded_at,
                           f.name AS facility FROM patient_document d JOIN hospital_facility f ON f.facility_id = d.facility_id
                    WHERE d.patient_id = ? ORDER BY d.uploaded_at""", patientId)) {
                String fid = d.get("facility_id").toString();
                orgNames.put(fid, (String) d.get("facility"));
                Map<String, Object> r = resource("DocumentReference", d.get("document_id").toString(), tier);
                r.put("status", "current");
                r.put("subject", ref("Patient", pid, null));
                r.put("date", iso(d.get("uploaded_at")));
                if (d.get("description") != null) r.put("description", d.get("description"));
                r.put("custodian", ref("Organization", fid, (String) d.get("facility")));
                r.put("content", List.of(Map.of("attachment", Map.of(
                        "contentType", d.get("content_type"), "title", d.get("file_name"),
                        "size", ((Number) d.get("size_bytes")).longValue(),
                        "url", "/engine/api/v1/documents/" + d.get("document_id")))));
                entries.add(entry(r));
            }
            // Organisations last, once each.
            for (var o : jdbc.queryForList("SELECT facility_id, name, province, last_synced_at FROM hospital_facility")) {
                String fid = o.get("facility_id").toString();
                if (!orgNames.containsKey(fid)) continue;
                Map<String, Object> r = resource("Organization", fid, tier);
                r.put("name", o.get("name"));
                r.put("address", List.of(Map.of("state", o.get("province"), "country", "ZA")));
                entries.add(entry(r));
            }
        }

        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("resourceType", "Bundle");
        bundle.put("id", UUID.randomUUID().toString());
        bundle.put("meta", Map.of("profile", List.of(PROFILE + "nhi-everything-" + tier)));
        bundle.put("type", "collection");
        bundle.put("timestamp", OffsetDateTime.now(SA).toString());
        bundle.put("entry", entries);
        return bundle;
    }

    // ---------------------------------------------------------------- helpers

    private static Map<String, Object> resource(String type, String id, String tier) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("resourceType", type);
        r.put("id", id);
        r.put("meta", Map.of("profile", List.of(PROFILE + "nhi-" + type.toLowerCase(Locale.ROOT) + "-" + tier)));
        return r;
    }

    private static Map<String, Object> entry(Map<String, Object> resource) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("fullUrl", BASE + "/" + resource.get("resourceType") + "/" + resource.get("id"));
        e.put("resource", resource);
        return e;
    }

    private static Map<String, Object> ref(String type, String id, String display) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("reference", type + "/" + id);
        if (display != null) r.put("display", display);
        return r;
    }

    /** In the lite tier Organization resources are omitted, so the reference carries only the display name. */
    private static Map<String, Object> ref(String type, String id, String display, boolean lite) {
        return lite ? Map.of("display", display) : ref(type, id, display);
    }

    private static Map<String, Object> codeable(String standard, String local, String text, boolean lite) {
        Map<String, Object> c = new LinkedHashMap<>();
        if (!lite) {
            List<Map<String, Object>> coding = new ArrayList<>();
            if (standard != null) coding.add(Map.of("system", "https://nhi-connect.local/fhir/CodeSystem/standard", "code", standard));
            if (local != null) coding.add(Map.of("system", "https://nhi-connect.local/fhir/CodeSystem/local", "code", local));
            if (!coding.isEmpty()) c.put("coding", coding);
        } else if (standard != null) {
            c.put("coding", List.of(Map.of("system", "https://nhi-connect.local/fhir/CodeSystem/standard", "code", standard)));
        }
        c.put("text", text);
        return c;
    }

    private static void narrative(Map<String, Object> r, String text) {
        String safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        r.put("text", Map.of("status", "generated", "div", "<div xmlns=\"http://www.w3.org/1999/xhtml\">" + safe + "</div>"));
    }

    private static Map<String, Object> encounterClass(String type) {
        String code = switch (type == null ? "" : type) {
            case "EMERGENCY" -> "EMER";
            case "ADMISSION" -> "IMP";
            default -> "AMB";
        };
        return Map.of("system", "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code", code);
    }

    private static String iso(Object ts) {
        if (ts instanceof java.sql.Timestamp t) return t.toInstant().atZone(SA).toOffsetDateTime().toString();
        if (ts instanceof OffsetDateTime o) return o.toString();
        return ts.toString();
    }
}
