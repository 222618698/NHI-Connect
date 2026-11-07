package za.nhiconnect.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import za.nhiconnect.auth.AuditService;
import za.nhiconnect.auth.CurrentUser;
import za.nhiconnect.dto.UnifiedRecordDto;
import za.nhiconnect.service.PatientRecordService;
import za.nhiconnect.service.RecordEntryService;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** National record lookup and updates. Used by clinicians and by clinic staff; every access is audited. */
@RestController
@RequestMapping("/engine/api/v1/patients")
@Validated
public class PatientController {

    public record NewEntry(
            @NotBlank @Pattern(regexp = "ENCOUNTER|LAB|MEDICATION", message = "Choose visit, lab result or medication.") String type,
            @NotNull(message = "Enter the date.") @PastOrPresent(message = "The date can't be in the future.") LocalDate date,
            @Pattern(regexp = "OUTPATIENT|EMERGENCY|ADMISSION|ANTENATAL|FOLLOW_UP", message = "Unknown visit type.") String encounterType,
            @NotBlank(message = "Enter a title.") @Size(max = 200) String title,
            @Size(max = 4000) String detail) {}

    private final PatientRecordService service;
    private final RecordEntryService entries;
    private final AuditService audit;

    public PatientController(PatientRecordService service, RecordEntryService entries, AuditService audit) {
        this.service = service;
        this.entries = entries;
        this.audit = audit;
    }

    /** GET /engine/api/v1/patients/search?idNumber=8801015800083 */
    @GetMapping("/search")
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

    /** GET /engine/api/v1/patients/{patientId}/record */
    @GetMapping("/{patientId}/record")
    public ResponseEntity<UnifiedRecordDto> record(HttpServletRequest request, @PathVariable UUID patientId) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        var record = service.getUnifiedRecord(patientId);
        record.ifPresent(r -> audit.log(user, "RECORD_VIEW", patientId, "Patient: " + r.patient().fullName(), AuditService.SUCCESS));
        return record.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /engine/api/v1/patients/{patientId}/entries: add a visit, lab result or medication at the user's own facility.
     * When a clinician/nurse adds it, it is also sent to their clinic for review.
     */
    @PostMapping("/{patientId}/entries")
    public Map<String, Object> addEntry(HttpServletRequest request, @PathVariable UUID patientId, @Valid @RequestBody NewEntry body) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        UUID id = entries.addEntry(user, patientId,
                new RecordEntryService.Entry(body.type(), body.date(), body.encounterType(), body.title(), body.detail()));
        return Map.of("id", id, "sentForReview", CurrentUser.CLINICIAN.equals(user.role()));
    }
}
