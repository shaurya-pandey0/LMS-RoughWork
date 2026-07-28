package com.lifetrack.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public class AnalyticsDtos {

    public record SleepPoint(LocalDate date, Double hours) {}

    public record DailyExpensePoint(LocalDate date, double totalAmount) {}

    public record UserAnalyticsResponse(
            List<SleepPoint> sleepPoints,
            List<SleepPoint> weeklySleep,
            List<DailyExpensePoint> dailyExpenses,
            Map<String, Double> expensesByCategory,
            double totalExpenses,
            double budgetUsagePct,
            double monthlyBudget,
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
