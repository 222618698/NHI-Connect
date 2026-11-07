package za.nhiconnect.web;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/** Every error leaves the API as {"message": "..."} so the UI can show it as-is. */
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, String>> badRequest(ConstraintViolationException ex) {
        return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> invalidBody(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream().findFirst()
                .map(e -> e.getDefaultMessage()).orElse("Some details are missing or invalid.");
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> status(ResponseStatusException ex) {
        String reason = ex.getReason() != null ? ex.getReason() : "Request failed.";
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", reason));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> tooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("message", "Files must be 10 MB or smaller."));
    }

    /** REQ-006: a consent restriction blocks this user; the UI offers break-glass when allowed. */
    @ExceptionHandler(za.nhiconnect.service.ConsentRestrictedException.class)
    public ResponseEntity<Map<String, Object>> consent(za.nhiconnect.service.ConsentRestrictedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "message", ex.getMessage(), "code", "CONSENT_RESTRICTED", "breakGlassAvailable", ex.breakGlassAvailable()));
    }
}
