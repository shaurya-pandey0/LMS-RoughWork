package com.lifetrack.service;

import com.lifetrack.dto.AnalyticsDtos.AdminStatsResponse;
import com.lifetrack.dto.AnalyticsDtos.SleepPoint;
import com.lifetrack.dto.AnalyticsDtos.UserAnalyticsResponse;
import com.lifetrack.entity.DailyLog;
import com.lifetrack.entity.Expense;
import com.lifetrack.entity.JournalEntry;
import com.lifetrack.repository.DailyLogRepository;
import com.lifetrack.repository.ExpenseRepository;
import com.lifetrack.repository.JournalEntryRepository;
import com.lifetrack.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private final DailyLogRepository dailyLogRepository;
    private final ExpenseRepository expenseRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final UserRepository userRepository;

    public AnalyticsService(DailyLogRepository dailyLogRepository,
                            ExpenseRepository expenseRepository,
                            JournalEntryRepository journalEntryRepository,
                            UserRepository userRepository) {
        this.dailyLogRepository = dailyLogRepository;
        this.expenseRepository = expenseRepository;
        this.journalEntryRepository = journalEntryRepository;
        this.userRepository = userRepository;
    }

    public UserAnalyticsResponse userAnalytics(Long userId) {
        LocalDate today = LocalDate.now();
        LocalDate weekAgo = today.minusDays(6);

        List<SleepPoint> weeklySleep = dailyLogRepository
                .findByUserIdAndDateBetweenOrderByDateAsc(userId, weekAgo, today)
                .stream()
                .map(log -> new SleepPoint(log.getDate(), log.getSleepHours()))
                .collect(Collectors.toList());

        List<Expense> expenses = expenseRepository.findByUserIdOrderByDateDesc(userId);
        Map<String, Double> byCategory = expenses.stream()
                .collect(Collectors.groupingBy(
                        Expense::getCategory,
                        LinkedHashMap::new,
                        Collectors.summingDouble(Expense::getAmount)));
        double total = expenses.stream().mapToDouble(Expense::getAmount).sum();

        List<JournalEntry> journals = journalEntryRepository.findByUserIdOrderByDateDesc(userId);
        Map<String, Long> moodCounts = journals.stream()
                .filter(j -> j.getMood() != null)
                .collect(Collectors.groupingBy(JournalEntry::getMood, LinkedHashMap::new, Collectors.counting()));

        return new UserAnalyticsResponse(weeklySleep, byCategory, total, moodCounts, journals.size());
    }

    public AdminStatsResponse adminStats() {
        List<Expense> allExpenses = expenseRepository.findAll();
        Map<String, Double> aggregatedExpenses = allExpenses.stream()
                .collect(Collectors.groupingBy(
                        Expense::getCategory,
                        LinkedHashMap::new,
                        Collectors.summingDouble(Expense::getAmount)));

        List<JournalEntry> allJournals = journalEntryRepository.findAll();
        Map<String, Long> aggregatedMoods = allJournals.stream()
                .filter(j -> j.getMood() != null)
                .collect(Collectors.groupingBy(JournalEntry::getMood, LinkedHashMap::new, Collectors.counting()));

        return new AdminStatsResponse(
                userRepository.count(),
                dailyLogRepository.count(),
                allExpenses.size(),
                allJournals.size(),
                aggregatedExpenses,
                aggregatedMoods);
    }
}
