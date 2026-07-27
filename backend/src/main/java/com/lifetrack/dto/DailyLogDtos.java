package com.lifetrack.dto;

import com.lifetrack.entity.DailyLog;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class DailyLogDtos {

    public record MealDto(String name, List<String> items) {
        public static MealDto from(DailyLog.Meal meal) {
            return new MealDto(meal.getName(), meal.getItems());
        }

        public DailyLog.Meal toEntity() {
            DailyLog.Meal meal = new DailyLog.Meal();
            meal.setName(name);
            meal.setItems(items == null ? new ArrayList<>() : items);
            return meal;
        }
    }

    public record DailyLogRequest(
            LocalDate date,
            Double sleepHours,
            Integer stepTarget,
            Double waterIntake,
            List<String> transactionalHabits,
            List<String> embeddedHabits,
            List<MealDto> meals,
            String morningMood,
            String afternoonMood,
            String eveningMood
    ) {}

    public record DailyLogResponse(
            Long id,
            LocalDate date,
            Double sleepHours,
            Integer stepTarget,
            Double waterIntake,
            List<String> transactionalHabits,
            List<String> embeddedHabits,
            List<MealDto> meals,
            String morningMood,
            String afternoonMood,
            String eveningMood
    ) {
        public static DailyLogResponse from(DailyLog log) {
            List<MealDto> mealDtos = new ArrayList<>();
            if (log.getMeals() != null) {
                for (DailyLog.Meal m : log.getMeals()) {
                    mealDtos.add(MealDto.from(m));
                }
            }
            return new DailyLogResponse(
                    log.getId(),
                    log.getDate(),
                    log.getSleepHours(),
                    log.getStepTarget(),
                    log.getWaterIntake(),
                    log.getTransactionalHabits(),
                    log.getEmbeddedHabits(),
                    mealDtos,
                    log.getMorningMood(),
                    log.getAfternoonMood(),
                    log.getEveningMood()
            );
        }
    }
}
