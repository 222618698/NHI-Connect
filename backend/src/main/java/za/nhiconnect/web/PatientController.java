package za.nhiconnect.web;

import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import za.nhiconnect.dto.PatientSummaryDto;
import za.nhiconnect.dto.UnifiedRecordDto;
import za.nhiconnect.service.PatientRecordService;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/engine/api/v1/patients")
@Validated
public class PatientController {

    private final PatientRecordService service;

    public PatientController(PatientRecordService service) {
        this.service = service;
    }

    /** GET /engine/api/v1/patients/search?idNumber=8801015800083 */
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam @Pattern(regexp = "\\d{13}", message = "ID number must be 13 digits") String idNumber) {
        return service.findByNationalId(idNumber)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of("message", "No patient found for ID " + idNumber)));
    }

    /** GET /engine/api/v1/patients/{patientId}/record */
    @GetMapping("/{patientId}/record")
    public ResponseEntity<UnifiedRecordDto> record(@PathVariable UUID patientId) {
        return service.getUnifiedRecord(patientId).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }
}
