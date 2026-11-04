package za.nhiconnect.dto;

import java.util.List;

public record UnifiedRecordDto(
        PatientSummaryDto patient,
        int facilityCount,
        List<String> provinces,
        List<TimelineEntryDto> timeline,
        String completenessNotice) {}
