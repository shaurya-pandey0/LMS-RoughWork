package com.lifetrack.service;

import com.lifetrack.dto.DailyLogDtos.DailyLogRequest;
import com.lifetrack.dto.DailyLogDtos.MealDto;
import com.lifetrack.entity.DailyLog;
import com.lifetrack.exception.ResourceNotFoundException;
import com.lifetrack.repository.DailyLogRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class DailyLogService {

    private final DailyLogRepository dailyLogRepository;

    public DailyLogService(DailyLogRepository dailyLogRepository) {
        this.dailyLogRepository = dailyLogRepository;
    }

    public List<DailyLog> findAll(Long userId) {
        return dailyLogRepository.findByUserIdOrderByDateDesc(userId);
    }

    public DailyLog findById(Long userId, Long id) {
        return dailyLogRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Daily log not found: " + id));
    }

    public DailyLog create(Long userId, DailyLogRequest request) {
        LocalDate date = request.date() != null ? request.date() : LocalDate.now();
        // A user has at most one log per date (enforced by a unique index). Upsert
        // so re-logging the same day updates the existing entry instead of failing
        // with a duplicate-key error.
        DailyLog log = dailyLogRepository.findByUserIdAndDate(userId, date)
                .orElseGet(() -> {
                    DailyLog created = new DailyLog();
                    created.setUserId(userId);
                    created.setCreatedAt(Instant.now());
                    return created;
                });
        apply(log, request);
        log.setUpdatedAt(Instant.now());
        return dailyLogRepository.save(log);
    }

    public DailyLog update(Long userId, Long id, DailyLogRequest request) {
        DailyLog log = findById(userId, id);
        apply(log, request);
        log.setUpdatedAt(Instant.now());
        return dailyLogRepository.save(log);
    }

    public void delete(Long userId, Long id) {
        DailyLog log = findById(userId, id);
        dailyLogRepository.delete(log);
    }

    private void apply(DailyLog log, DailyLogRequest request) {
        log.setDate(request.date() != null ? request.date() : LocalDate.now());
        log.setSleepHours(request.sleepHours());
        log.setStepTarget(request.stepTarget());
        log.setWaterIntake(request.waterIntake());
        log.setTransactionalHabits(request.transactionalHabits() != null ? request.transactionalHabits() : new ArrayList<>());
        log.setEmbeddedHabits(request.embeddedHabits() != null ? request.embeddedHabits() : new ArrayList<>());
        List<DailyLog.Meal> meals = new ArrayList<>();
        if (request.meals() != null) {
            for (MealDto m : request.meals()) {
                meals.add(m.toEntity());
            }
        }
        log.setMeals(meals);
        log.setMorningMood(request.morningMood());
        log.setAfternoonMood(request.afternoonMood());
        log.setEveningMood(request.eveningMood());
    }
}
