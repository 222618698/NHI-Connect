package za.nhiconnect.util;

import java.util.*;

/**
 * Decides whether two laboratory test names refer to the same test, and how recent a prior result must be to
 * count as a duplicate (Clinical Decision Support, REQ-004; "EQUIVALENCE_WINDOW" in Design §3.2.2).
 * Local names vary between hospitals ("FBC", "Full Blood Count & CRP"), so names are normalised and common
 * abbreviations expanded before comparing.
 */
public final class TestEquivalence {

    /** Days within which a repeat of the test is considered a likely duplicate. */
    public static final int DEFAULT_WINDOW_DAYS = 30;

    private static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("fbc", "full blood count"), Map.entry("cbc", "full blood count"),
            Map.entry("u&e", "urea electrolytes"), Map.entry("ue", "urea electrolytes"),
            Map.entry("lft", "liver function"), Map.entry("lfts", "liver function"),
            Map.entry("crp", "c reactive protein"), Map.entry("vl", "viral load"),
            Map.entry("a1c", "hba1c"), Map.entry("tsh", "thyroid stimulating hormone"));

    /** Words that describe how a test was reported rather than which test it is. */
    private static final Set<String> NOISE = Set.of("test", "tests", "panel", "result", "results", "level",
            "levels", "quantitative", "qualitative", "screen", "check", "and", "the", "of", "std");

    // First matching keyword wins, so more specific entries come first.
    private static final LinkedHashMap<String, Integer> WINDOWS = new LinkedHashMap<>();
    static {
        WINDOWS.put("troponin", 1);
        WINDOWS.put("hba1c", 90);
        WINDOWS.put("lipid", 180);
        WINDOWS.put("lipogram", 180);
        WINDOWS.put("cholesterol", 180);
        WINDOWS.put("viral load", 180);
        WINDOWS.put("cd4", 180);
        WINDOWS.put("full blood count", 30);
        WINDOWS.put("glucose", 30);
        WINDOWS.put("urea electrolytes", 30);
        WINDOWS.put("creatinine", 30);
    }

    private TestEquivalence() {}

    /** Lower-cases, expands abbreviations, drops punctuation and noise words. */
    public static List<String> tokens(String name) {
        if (name == null) return List.of();
        String cleaned = name.toLowerCase(Locale.ROOT).replaceAll("\\(.*?\\)", " ");
        List<String> out = new ArrayList<>();
        for (String raw : cleaned.split("[^a-z0-9&]+")) {
            if (raw.isBlank()) continue;
            // Look abbreviations up before splitting on '&', so "U&E" is recognised (DEF-019).
            List<String> parts = ALIASES.containsKey(raw) ? List.of(ALIASES.get(raw)) : List.of(raw.split("&"));
            for (String part : parts) {
                String expanded = ALIASES.getOrDefault(part, part);
                for (String t : expanded.split(" ")) {
                    if (!t.isBlank() && !NOISE.contains(t)) out.add(t);
                }
            }
        }
        return out;
    }

    public static String normalise(String name) {
        return String.join(" ", tokens(name));
    }

    /** True if every word of the shorter (normalised) name occurs, in order, in the longer one. */
    public static boolean sameTest(String a, String b) {
        String na = normalise(a), nb = normalise(b);
        if (na.isEmpty() || nb.isEmpty()) return false;
        String shorter = na.length() <= nb.length() ? na : nb;
        String longer = shorter == na ? nb : na;
        return (" " + longer + " ").contains(" " + shorter + " ");
    }

    public static int windowDays(String name) {
        String n = " " + normalise(name) + " ";
        for (var e : WINDOWS.entrySet()) {
            if (n.contains(" " + e.getKey() + " ")) return e.getValue();
        }
        return DEFAULT_WINDOW_DAYS;
    }
}
