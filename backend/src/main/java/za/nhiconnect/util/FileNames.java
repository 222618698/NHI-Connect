package za.nhiconnect.util;

/** Makes an uploaded file's name safe to store and to send back in a Content-Disposition header. */
public final class FileNames {

    private FileNames() {}

    /**
     * Strips any directory part, replaces characters outside a safe set with "_", and falls back to
     * "document.&lt;extension&gt;" when nothing usable is left. Never returns more than 200 characters.
     */
    public static String clean(String original, String extension) {
        String base = original == null ? "" : original.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ ()-]", "_").trim();
        if (base.isEmpty() || base.startsWith(".")) base = "document." + extension;
        return base.length() > 200 ? base.substring(base.length() - 200) : base;
    }
}
