package za.nhiconnect.service;

/** Thrown when a patient's consent restriction blocks the signed-in user's facility (HTTP 403, REQ-006). */
public class ConsentRestrictedException extends RuntimeException {
    private final boolean breakGlassAvailable;

    public ConsentRestrictedException(String message, boolean breakGlassAvailable) {
        super(message);
        this.breakGlassAvailable = breakGlassAvailable;
    }

    public boolean breakGlassAvailable() {
        return breakGlassAvailable;
    }
}
