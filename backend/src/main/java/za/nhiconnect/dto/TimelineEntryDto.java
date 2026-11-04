package za.nhiconnect.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** One row on the Unified Record Timeline, regardless of source table. */
public record TimelineEntryDto(
        UUID id,
        String type,            // ENCOUNTER | LAB | MEDICATION
        OffsetDateTime date,
        String title,
        String detail,
        String facilityName,
        String facilityShortName,
        String province,
        OffsetDateTime facilityLastSyncedAt) {}
