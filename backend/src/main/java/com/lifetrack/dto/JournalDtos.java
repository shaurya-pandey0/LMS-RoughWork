package com.lifetrack.dto;

import com.lifetrack.entity.JournalEntry;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public class JournalDtos {

    public record JournalRequest(
            LocalDate date,
            @NotBlank String mood,
            @NotBlank String text
    ) {}

    public record JournalResponse(
            Long id,
            LocalDate date,
            String mood,
            String text
    ) {
        public static JournalResponse from(JournalEntry entry) {
            return new JournalResponse(
                    entry.getId(),
                    entry.getDate(),
                    entry.getMood(),
                    entry.getText()
            );
        }
    }
}
