package com.lifetrack.dto;

import com.lifetrack.entity.UserSettings;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public class UserSettingsDtos {

    public record UserSettingsRequest(
            @PositiveOrZero double monthlyBudget,
            @Positive double sleepTargetHours,
            @Positive int stepTarget,
            @Positive double waterTargetMl,

            // ── insight preferences ─────────────────────────────────────────
            @Min(7) @Max(30) int insightPeriodDays,
            @Min(1) @Max(30) int minPairedDays,
            @PositiveOrZero double lowSleepThreshold,
            @Min(0) @Max(100) int habitConsistencyTarget
    ) {}

    public record UserSettingsResponse(
            double monthlyBudget,
            double sleepTargetHours,
            int stepTarget,
            double waterTargetMl,
            int insightPeriodDays,
            int minPairedDays,
            double lowSleepThreshold,
            int habitConsistencyTarget
    ) {
        public static UserSettingsResponse from(UserSettings s) {
            return new UserSettingsResponse(
                    s.getMonthlyBudget(),
                    s.getSleepTargetHours(),
                    s.getStepTarget(),
                    s.getWaterTargetMl(),
                    s.getInsightPeriodDays(),
                    s.getMinPairedDays(),
                    s.getLowSleepThreshold(),
                    s.getHabitConsistencyTarget()
            );
        }
    }
}
