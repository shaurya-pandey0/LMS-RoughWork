package com.lifetrack.controller;

import com.lifetrack.dto.DailyLogDtos.DailyLogRequest;
import com.lifetrack.dto.DailyLogDtos.DailyLogResponse;
import com.lifetrack.security.SecurityUtils;
import com.lifetrack.service.DailyLogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/daily-logs")
public class DailyLogController {

    private final DailyLogService dailyLogService;

    public DailyLogController(DailyLogService dailyLogService) {
        this.dailyLogService = dailyLogService;
    }

    @GetMapping
    public List<DailyLogResponse> list() {
        Long userId = SecurityUtils.currentUserId();
        return dailyLogService.findAll(userId).stream()
                .map(DailyLogResponse::from)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public DailyLogResponse get(@PathVariable Long id) {
        return DailyLogResponse.from(dailyLogService.findById(SecurityUtils.currentUserId(), id));
    }

    @PostMapping
    public ResponseEntity<DailyLogResponse> create(@Valid @RequestBody DailyLogRequest request) {
        DailyLogResponse body = DailyLogResponse.from(
                dailyLogService.create(SecurityUtils.currentUserId(), request));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PutMapping("/{id}")
    public DailyLogResponse update(@PathVariable Long id, @Valid @RequestBody DailyLogRequest request) {
        return DailyLogResponse.from(dailyLogService.update(SecurityUtils.currentUserId(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        dailyLogService.delete(SecurityUtils.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }
}
