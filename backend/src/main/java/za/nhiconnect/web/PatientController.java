package za.nhiconnect.web;

import com.lowagie.text.DocumentException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import za.nhiconnect.auth.AuditService;
import za.nhiconnect.auth.CurrentUser;
import za.nhiconnect.dto.UnifiedRecordDto;
import za.nhiconnect.service.*;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * National record: lookup, unified timeline, updates, break-glass, referral summary, FHIR export and the
 * duplicate-test check. Used by clinicians and clinic staff; every access is audited and consent-checked.
 */
@RestController
@RequestMapping("/engine/api/v1")
@Validated
public class PatientController {

    public record NewEntry(
            @NotBlank @Pattern(regexp = "ENCOUNTER|LAB|MEDICATION", message = "Choose visit, lab result or medication.") String type,
            @NotNull(message = "Enter the date.") @PastOrPresent(message = "The date can't be in the future.") LocalDate date,
            @Pattern(regexp = "OUTPATIENT|EMERGENCY|ADMISSION|ANTENATAL|FOLLOW_UP", message = "Unknown visit type.") String encounterType,
            @NotBlank(message = "Enter a title.") @Size(max = 200) String title,
            @Size(max = 4000) String detail) {}

    public record BreakGlassRequest(
            @NotBlank(message = "Choose a reason code.") String reasonCode,
            @NotBlank(message = "Describe the emergency.") @Size(min = 10, max = 500, message = "Describe the emergency in 10-500 characters.") String freeText) {}

    public record DuplicateCheckRequest(
            @NotNull UUID patientId,
            @NotBlank(message = "Enter the test name.") @Size(max = 200) String testName,
            LocalDate orderDate) {}

    private static final MediaType FHIR_JSON = MediaType.parseMediaType("application/fhir+json");

    private final PatientRecordService service;
    private final RecordEntryService entries;
    private final ConsentService consent;
    private final DecisionSupportService decisionSupport;
    private final ReferralSummaryService referrals;
    private final FhirExportService fhir;
    private final AuditService audit;

    public PatientController(PatientRecordService service, RecordEntryService entries, ConsentService consent,
                             DecisionSupportService decisionSupport, ReferralSummaryService referrals,
                             FhirExportService fhir, AuditService audit) {
        this.service = service;
        this.entries = entries;
        this.consent = consent;
        this.decisionSupport = decisionSupport;
        this.referrals = referrals;
        this.fhir = fhir;
        this.audit = audit;
    }

    /** GET /engine/api/v1/patients/search?idNumber=8801015800083 */
    @GetMapping("/patients/search")
    public ResponseEntity<?> search(HttpServletRequest request,
                                    @RequestParam @Pattern(regexp = "\\d{13}", message = "ID number must be 13 digits") String idNumber) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        var found = service.findByNationalId(idNumber);
        if (found.isEmpty()) {
            audit.log(user, "PATIENT_SEARCH", null, "ID: " + idNumber + " (no match)", AuditService.FLAGGED);
            return ResponseEntity.status(404).body(Map.of("message", "No patient found for ID " + idNumber));
        }
        audit.log(user, "PATIENT_SEARCH", found.get().patientId(), "ID: " + idNumber, AuditService.SUCCESS);
        return ResponseEntity.ok(found.get());
    }

    /** GET /engine/api/v1/patients/{patientId}/record — consent-checked. */
    @GetMapping("/patients/{patientId}/record")
    public ResponseEntity<UnifiedRecordDto> record(HttpServletRequest request, @PathVariable UUID patientId) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        var record = service.getUnifiedRecord(patientId);
        if (record.isEmpty()) return ResponseEntity.notFound().build();
        consent.requireAccess(user, patientId);
        audit.log(user, "RECORD_VIEW", patientId, "Patient: " + record.get().patient().fullName(), AuditService.SUCCESS);
        return ResponseEntity.ok(record.get());
    }

    /**
     * POST /engine/api/v1/patients/{patientId}/break-glass — emergency override of a consent restriction.
     * Returns the record for this one request only; the next normal request is restricted again.
     */
    @PostMapping("/patients/{patientId}/break-glass")
    public UnifiedRecordDto breakGlass(HttpServletRequest request, @PathVariable UUID patientId, @Valid @RequestBody BreakGlassRequest body) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN);
        if (!ConsentService.REASON_CODES.contains(body.reasonCode())) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Unknown reason code.");
        }
        var record = service.getUnifiedRecord(patientId)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Patient not found."));
        consent.recordBreakGlass(user, patientId, body.reasonCode(), body.freeText());
        return record;
    }

    /** POST /engine/api/v1/patients/{patientId}/entries — add a visit, lab result or medication at the user's facility. */
    @PostMapping("/patients/{patientId}/entries")
    public Map<String, Object> addEntry(HttpServletRequest request, @PathVariable UUID patientId, @Valid @RequestBody NewEntry body) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        UUID id = entries.addEntry(user, patientId,
                new RecordEntryService.Entry(body.type(), body.date(), body.encounterType(), body.title(), body.detail()));
        return Map.of("id", id, "sentForReview", CurrentUser.CLINICIAN.equals(user.role()));
    }

    /** GET /engine/api/v1/patients/{patientId}/referral-summary — PDF for handing the patient over (REQ-009). */
    @GetMapping("/patients/{patientId}/referral-summary")
    public ResponseEntity<byte[]> referralSummary(HttpServletRequest request, @PathVariable UUID patientId) throws DocumentException {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        consent.requireAccess(user, patientId);
        byte[] pdf = referrals.build(user, patientId);
        audit.log(user, "REFERRAL_SUMMARY", patientId, "Referral summary generated (" + pdf.length / 1024 + " KB)", AuditService.SUCCESS);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("referral-summary.pdf").build().toString())
                .body(pdf);
    }

    /** GET /engine/api/v1/fhir/Patient/{patientId}/$everything?profile=full|lite — FHIR R4 Bundle (REQ-005). */
    @GetMapping("/fhir/Patient/{patientId}/$everything")
    public ResponseEntity<Map<String, Object>> fhirEverything(HttpServletRequest request, @PathVariable UUID patientId,
                                                              @RequestParam(defaultValue = "full") @Pattern(regexp = "full|lite", message = "profile must be full or lite") String profile) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        consent.requireAccess(user, patientId);
        Map<String, Object> bundle = fhir.everything(patientId, "lite".equals(profile));
        audit.log(user, "FHIR_EXPORT", patientId, "FHIR R4 Bundle, " + profile + " profile", AuditService.SUCCESS);
        return ResponseEntity.ok().contentType(FHIR_JSON).body(bundle);
    }

    /** POST /engine/api/v1/decision-support/check-duplicate — advisory duplicate-test warning (REQ-004). */
    @PostMapping("/decision-support/check-duplicate")
    public DecisionSupportService.DuplicateCheck checkDuplicate(HttpServletRequest request, @Valid @RequestBody DuplicateCheckRequest body) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        consent.requireAccess(user, body.patientId());
        return decisionSupport.check(user, body.patientId(), body.testName(), body.orderDate());
    }
}
