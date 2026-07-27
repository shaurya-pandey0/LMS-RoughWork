package com.lifetrack.service;

import com.lifetrack.config.InsightProperties;
import com.lifetrack.dto.InsightDtos.Insight;
import com.lifetrack.dto.InsightDtos.InsightsResponse;
import com.lifetrack.dto.InsightDtos.Severity;
import com.lifetrack.entity.DailyLog;
import com.lifetrack.entity.Expense;
import com.lifetrack.entity.JournalEntry;
import com.lifetrack.repository.DailyLogRepository;
import com.lifetrack.repository.ExpenseRepository;
import com.lifetrack.repository.JournalEntryRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.OptionalDouble;
import java.util.Set;

/**
 * Rule-based insight engine (Phase 4a).
 *
 * <p>Deterministic, dependency-free analysis of the user's trailing 7 days of
 * data. Always available and fast — no external AI service required. Each rule
 * emits at most one {@link Insight}; rules stay silent when there isn't enough
 * data to say anything meaningful.
 */
@Service
public class InsightService {

    /** Window analysed by every rule: today plus the previous 6 days. */
    private static final int WINDOW_DAYS = 7;

    private static final Set<String> NEGATIVE_MOODS = Set.of("anxious", "tired", "sad", "stressed", "angry");
    private static final Set<String> POSITIVE_MOODS = Set.of("happy", "calm", "grateful", "great", "good");

    private final DailyLogRepository dailyLogRepository;
    private final ExpenseRepository expenseRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final InsightProperties properties;

    public InsightService(DailyLogRepository dailyLogRepository,
                          ExpenseRepository expenseRepository,
                          JournalEntryRepository journalEntryRepository,
                          InsightProperties properties) {
        this.dailyLogRepository = dailyLogRepository;
        this.expenseRepository = expenseRepository;
        this.journalEntryRepository = journalEntryRepository;
        this.properties = properties;
    }

    public InsightsResponse generate(Long userId) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(WINDOW_DAYS - 1L);

        List<DailyLog> logs = dailyLogRepository.findByUserIdAndDateBetweenOrderByDateAsc(userId, from, today);
        List<Expense> expenses = expenseRepository.findByUserIdAndDateBetween(userId, from, today);
        List<JournalEntry> journals = journalEntryRepository.findByUserIdAndDateBetween(userId, from, today);

        List<Insight> insights = new ArrayList<>();
        evaluateSleep(logs, insights);
        evaluateSpending(expenses, insights);
        evaluateHabitConsistency(logs, insights);
        evaluateHydration(logs, insights);
        evaluateMood(logs, journals, insights);

        if (insights.isEmpty()) {
            insights.add(new Insight(
                    "GENERAL",
                    Severity.INFO,
                    "Not enough data yet",
                    "Keep logging your days, expenses, and journal entries to unlock personalised insights.",
                    null));
        }

        return new InsightsResponse(from, today, insights);
    }

    private void evaluateSleep(List<DailyLog> logs, List<Insight> insights) {
        OptionalDouble avg = logs.stream()
                .filter(l -> l.getSleepHours() != null)
                .mapToDouble(DailyLog::getSleepHours)
                .average();
        if (avg.isEmpty()) {
            return;
        }
        double avgSleep = round(avg.getAsDouble());
        if (avgSleep < properties.getMinSleepHours()) {
            insights.add(new Insight(
                    "SLEEP",
                    Severity.WARNING,
                    "Insufficient sleep",
                    String.format(Locale.US,
                            "You're averaging %.1f hours of sleep this week, below the %.1f-hour minimum. Try an earlier wind-down routine.",
                            avgSleep, properties.getMinSleepHours()),
                    avgSleep));
        } else if (avgSleep >= properties.getGoodSleepHours()) {
            insights.add(new Insight(
                    "SLEEP",
                    Severity.POSITIVE,
                    "Healthy sleep",
                    String.format(Locale.US,
                            "Nice work — you're averaging %.1f hours of sleep this week.", avgSleep),
                    avgSleep));
        }
    }

    private void evaluateSpending(List<Expense> expenses, List<Insight> insights) {
        if (expenses.isEmpty()) {
            return;
        }
        double weeklySpend = round(expenses.stream().mapToDouble(Expense::getAmount).sum());
        if (weeklySpend > properties.getWeeklySpendingThreshold()) {
            insights.add(new Insight(
                    "SPENDING",
                    Severity.WARNING,
                    "Overspending",
                    String.format(Locale.US,
                            "You've spent %.2f over the past week, above your %.2f threshold. Review your largest categories.",
                            weeklySpend, properties.getWeeklySpendingThreshold()),
                    weeklySpend));
        }
    }

    private void evaluateHabitConsistency(List<DailyLog> logs, List<Insight> insights) {
        // Need at least a few logged days before judging consistency.
        if (logs.size() < 3) {
            return;
        }
        long daysWithHabits = logs.stream()
                .filter(l -> (l.getTransactionalHabits() != null && !l.getTransactionalHabits().isEmpty())
                        || (l.getEmbeddedHabits() != null && !l.getEmbeddedHabits().isEmpty()))
                .count();
        double rate = (double) daysWithHabits / WINDOW_DAYS;
        if (rate < properties.getHabitConsistencyThreshold()) {
            insights.add(new Insight(
                    "HABITS",
                    Severity.WARNING,
                    "Low consistency",
                    String.format(Locale.US,
                            "You logged habits on %d of the last %d days (%.0f%%). Small daily wins build momentum.",
                            daysWithHabits, WINDOW_DAYS, rate * 100),
                    round(rate)));
        }
    }

    private void evaluateHydration(List<DailyLog> logs, List<Insight> insights) {
        OptionalDouble avg = logs.stream()
                .filter(l -> l.getWaterIntake() != null)
                .mapToDouble(DailyLog::getWaterIntake)
                .average();
        if (avg.isEmpty()) {
            return;
        }
        double avgWater = round(avg.getAsDouble());
        if (avgWater < properties.getMinWaterIntakeMl()) {
            insights.add(new Insight(
                    "HYDRATION",
                    Severity.WARNING,
                    "Low hydration",
                    String.format(Locale.US,
                            "You're averaging %.0f ml of water a day, below the %.0f ml target. Keep a bottle within reach.",
                            avgWater, properties.getMinWaterIntakeMl()),
                    avgWater));
        }
    }

    private void evaluateMood(List<DailyLog> logs, List<JournalEntry> journals, List<Insight> insights) {
        List<String> moods = new ArrayList<>();
        journals.stream().map(JournalEntry::getMood).filter(java.util.Objects::nonNull).forEach(moods::add);
        for (DailyLog log : logs) {
            addIfPresent(moods, log.getMorningMood());
            addIfPresent(moods, log.getAfternoonMood());
            addIfPresent(moods, log.getEveningMood());
        }
        if (moods.isEmpty()) {
            return;
        }
        long negative = moods.stream().filter(m -> NEGATIVE_MOODS.contains(m.toLowerCase(Locale.US))).count();
        long positive = moods.stream().filter(m -> POSITIVE_MOODS.contains(m.toLowerCase(Locale.US))).count();
        if (negative > positive) {
            insights.add(new Insight(
                    "MOOD",
                    Severity.WARNING,
                    "Mood dip",
                    "Your recent moods skew negative. Consider what's draining you and lean on activities that recharge you.",
                    (double) negative));
        } else if (positive > 0 && positive >= negative) {
            insights.add(new Insight(
                    "MOOD",
                    Severity.POSITIVE,
                    "Positive mood",
                    "Your mood has been largely positive this week. Keep doing what's working.",
                    (double) positive));
        }
    }

    private static void addIfPresent(List<String> moods, String mood) {
        if (mood != null && !mood.isBlank()) {
            moods.add(mood);
        }
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
