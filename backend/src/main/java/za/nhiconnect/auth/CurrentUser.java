package za.nhiconnect.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.UUID;

/** The signed-in user for the current request. Set by {@link AuthInterceptor}. */
public record CurrentUser(UUID id, String username, String fullName, String role, UUID facilityId, String facilityName) {

    public static final String ADMIN = "ADMIN";
    public static final String CLINIC = "CLINIC";
    public static final String CLINICIAN = "CLINICIAN";

    static final String REQUEST_ATTRIBUTE = CurrentUser.class.getName();

    /** Returns the signed-in user, or 403 if their role is not one of {@code allowedRoles}. */
    public static CurrentUser require(HttpServletRequest request, String... allowedRoles) {
        CurrentUser user = (CurrentUser) request.getAttribute(REQUEST_ATTRIBUTE);
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in.");
        if (allowedRoles.length > 0 && Arrays.stream(allowedRoles).noneMatch(user.role()::equals)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your account does not have access to this.");
        }
        return user;
    }
}
