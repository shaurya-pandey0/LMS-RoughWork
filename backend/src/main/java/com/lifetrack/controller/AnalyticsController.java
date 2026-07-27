package com.lifetrack.controller;

import com.lifetrack.dto.AnalyticsDtos.UserAnalyticsResponse;
import com.lifetrack.security.SecurityUtils;
import com.lifetrack.service.AnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping
    public UserAnalyticsResponse analytics() {
        return analyticsService.userAnalytics(SecurityUtils.currentUserId());
    }
}
