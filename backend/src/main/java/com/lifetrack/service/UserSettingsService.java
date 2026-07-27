package com.lifetrack.service;

import com.lifetrack.dto.UserSettingsDtos.UserSettingsRequest;
import com.lifetrack.entity.UserSettings;
import com.lifetrack.repository.UserSettingsRepository;
import org.springframework.stereotype.Service;

@Service
public class UserSettingsService {

    private final UserSettingsRepository userSettingsRepository;

    public UserSettingsService(UserSettingsRepository userSettingsRepository) {
        this.userSettingsRepository = userSettingsRepository;
    }

    /** Every user gets defaults on first read — no explicit provisioning step needed. */
    public UserSettings getOrCreate(Long userId) {
        return userSettingsRepository.findByUserId(userId)
                .orElseGet(() -> {
                    UserSettings settings = new UserSettings();
                    settings.setUserId(userId);
                    return userSettingsRepository.save(settings);
                });
    }

    public UserSettings update(Long userId, UserSettingsRequest request) {
        UserSettings settings = getOrCreate(userId);
        settings.setMonthlyBudget(request.monthlyBudget());
        settings.setSleepTargetHours(request.sleepTargetHours());
        settings.setStepTarget(request.stepTarget());
        settings.setWaterTargetMl(request.waterTargetMl());
        return userSettingsRepository.save(settings);
    }
}
