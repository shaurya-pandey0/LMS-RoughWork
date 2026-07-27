package com.lifetrack.service;

import com.lifetrack.dto.ExpenseDtos.ExpenseRequest;
import com.lifetrack.entity.Expense;
import com.lifetrack.exception.ResourceNotFoundException;
import com.lifetrack.repository.ExpenseRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;

    public ExpenseService(ExpenseRepository expenseRepository) {
        this.expenseRepository = expenseRepository;
    }

    public List<Expense> findAll(Long userId) {
        return expenseRepository.findByUserIdOrderByDateDesc(userId);
    }

    public Expense findById(Long userId, Long id) {
        return expenseRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found: " + id));
    }

    public Expense create(Long userId, ExpenseRequest request) {
        Expense expense = new Expense();
        expense.setUserId(userId);
        apply(expense, request);
        return expenseRepository.save(expense);
    }

    public Expense update(Long userId, Long id, ExpenseRequest request) {
        Expense expense = findById(userId, id);
        apply(expense, request);
        return expenseRepository.save(expense);
    }

    public void delete(Long userId, Long id) {
        Expense expense = findById(userId, id);
        expenseRepository.delete(expense);
    }

    private void apply(Expense expense, ExpenseRequest request) {
        expense.setDate(request.date() != null ? request.date() : LocalDate.now());
        expense.setCategory(request.category());
        expense.setAmount(request.amount());
    }
}
