package za.nhiconnect.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import za.nhiconnect.auth.AuthInterceptor;
import za.nhiconnect.auth.AuthService;
import za.nhiconnect.auth.CurrentUser;

import java.util.Map;

@RestController
@RequestMapping("/security/api/v1/auth")
public class AuthController {

    public record LoginRequest(@NotBlank(message = "Enter your username.") String username,
                               @NotBlank(message = "Enter your password.") String password,
                               String role) {}

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    /** POST /security/api/v1/auth/login → { token, user } */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest body) {
        return auth.login(body.username(), body.password(), body.role())
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Incorrect username or password, or the account is disabled.")));
    }

    @GetMapping("/me")
    public CurrentUser me(HttpServletRequest request) {
        return CurrentUser.require(request);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        auth.logout(AuthInterceptor.bearerToken(request), CurrentUser.require(request));
        return ResponseEntity.noContent().build();
    }
}
