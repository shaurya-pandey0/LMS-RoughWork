package com.lifetrack.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Per-user targets that used to be hardcoded in the frontend (monthly budget,
 * sleep/step/water targets). One row per user, created with sane defaults the
 * first time it's requested (see {@code UserSettingsService}).
 */
@Entity
@Table(name = "user_settings")
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long userId;

    @Column(nullable = false)
    private double monthlyBudget = 4000.0;

    @Column(nullable = false)
    private double sleepTargetHours = 8.0;

    @Column(nullable = false)
    private int stepTarget = 10000;

    @Column(nullable = false)
    private double waterTargetMl = 2000.0;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public double getMonthlyBudget() {
        return monthlyBudget;
    }

    public void setMonthlyBudget(double monthlyBudget) {
        this.monthlyBudget = monthlyBudget;
    }

    public double getSleepTargetHours() {
        return sleepTargetHours;
    }

    public void setSleepTargetHours(double sleepTargetHours) {
        this.sleepTargetHours = sleepTargetHours;
    }

    public int getStepTarget() {
        return stepTarget;
    }

    public void setStepTarget(int stepTarget) {
        this.stepTarget = stepTarget;
    }

    public double getWaterTargetMl() {
        return waterTargetMl;
    }

    public void setWaterTargetMl(double waterTargetMl) {
        this.waterTargetMl = waterTargetMl;
    }
}
