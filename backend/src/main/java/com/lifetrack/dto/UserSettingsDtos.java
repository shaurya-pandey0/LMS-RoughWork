package com.lifetrack.dto;

import com.lifetrack.entity.UserSettings;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public class UserSettingsDtos {

    public record UserSettingsRequest(
            @PositiveOrZero double monthlyBudget,
            @Positive double sleepTargetHours,
            @Positive int stepTarget,
            @Positive double waterTargetMl
    ) {}

    public record UserSettingsResponse(
            double monthlyBudget,
            double sleepTargetHours,
            int stepTarget,
            double waterTargetMl
    ) {
        public static UserSettingsResponse from(UserSettings s) {
            return new UserSettingsResponse(
                    s.getMonthlyBudget(),
                    s.getSleepTargetHours(),
                    s.getStepTarget(),
                    s.getWaterTargetMl()
            );
        }
    }
}
