package com.lifetrack.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public class HabitDtos {

    public record HabitRequest(
            @NotBlank(message = "Habit name is required")
            @Size(max = 100, message = "Habit name cannot exceed 100 characters")
            String name,

            Boolean active
    ) {}

    public record HabitResponse(
            Long id,
            String name,
            boolean active,
            boolean completedToday
    ) {}

    public record ToggleCompletionRequest(
            LocalDate date,
            Boolean completed
    ) {}
}
