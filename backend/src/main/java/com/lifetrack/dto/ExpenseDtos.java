package com.lifetrack.dto;

import com.lifetrack.entity.Expense;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;

public class ExpenseDtos {

    public record ExpenseRequest(
            LocalDate date,
            @NotBlank String category,
            @Positive double amount
    ) {}

    public record ExpenseResponse(
            Long id,
            LocalDate date,
            String category,
            double amount
    ) {
        public static ExpenseResponse from(Expense expense) {
            return new ExpenseResponse(
                    expense.getId(),
                    expense.getDate(),
                    expense.getCategory(),
                    expense.getAmount()
            );
        }
    }
}
