package za.nhiconnect.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import za.nhiconnect.auth.AuditService;
import za.nhiconnect.auth.CurrentUser;
import za.nhiconnect.service.RecordEntryService;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

/** Patient documents. Clinicians and clinic staff can upload, list and open them; every open is audited. */
@RestController
@RequestMapping("/engine/api/v1")
public class DocumentController {

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final RecordEntryService entries;
    private final za.nhiconnect.service.ConsentService consent;

    public DocumentController(JdbcTemplate jdbc, AuditService audit, RecordEntryService entries,
                              za.nhiconnect.service.ConsentService consent) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.entries = entries;
        this.consent = consent;
    }

    @GetMapping("/patients/{patientId}/documents")
    public List<RecordEntryService.DocumentInfo> documents(HttpServletRequest request, @PathVariable UUID patientId) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        consent.requireAccess(user, patientId);
        return entries.listDocuments(patientId);
    }

    @PostMapping(path = "/patients/{patientId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public RecordEntryService.DocumentInfo upload(HttpServletRequest request, @PathVariable UUID patientId,
                                                  @RequestParam("file") MultipartFile file,
                                                  @RequestParam(value = "description", required = false) String description) throws IOException {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        return entries.uploadDocument(user, patientId, file, description);
    }

    @GetMapping("/documents/{documentId}")
    public ResponseEntity<byte[]> download(HttpServletRequest request, @PathVariable UUID documentId) {
        CurrentUser user = CurrentUser.require(request, CurrentUser.CLINICIAN, CurrentUser.CLINIC);
        var rows = jdbc.queryForList("SELECT patient_id, file_name, content_type, content FROM patient_document WHERE document_id = ?", documentId);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        var row = rows.get(0);
        consent.requireAccess(user, (UUID) row.get("patient_id"));
        String fileName = (String) row.get("file_name");
        audit.log(user, "DOCUMENT_VIEW", (UUID) row.get("patient_id"), fileName, AuditService.SUCCESS);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType((String) row.get("content_type")))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body((byte[]) row.get("content"));
    }
}
