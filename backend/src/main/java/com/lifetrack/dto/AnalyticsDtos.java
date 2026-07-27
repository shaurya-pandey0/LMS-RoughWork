package com.lifetrack.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public class AnalyticsDtos {

    public record SleepPoint(LocalDate date, Double hours) {}

    public record UserAnalyticsResponse(
            List<SleepPoint> weeklySleep,
            Map<String, Double> expensesByCategory,
            double totalExpenses,
            Map<String, Long> moodCounts,
            long journalEntryCount
    ) {}

    public record AdminStatsResponse(
            long totalUsers,
            long totalDailyLogs,
            long totalExpenses,
            long totalJournalEntries,
            Map<String, Double> aggregatedExpensesByCategory,
            Map<String, Long> aggregatedMoodCounts
    ) {}
}
