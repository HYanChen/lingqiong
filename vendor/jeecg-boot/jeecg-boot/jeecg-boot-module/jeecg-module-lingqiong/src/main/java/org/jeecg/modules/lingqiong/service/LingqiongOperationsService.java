package org.jeecg.modules.lingqiong.service;

import com.baomidou.dynamic.datasource.annotation.DS;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@DS("lingqiong")
public class LingqiongOperationsService {
    private final JdbcTemplate jdbcTemplate;

    public LingqiongOperationsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Long> summary() {
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("users", count("front_users"));
        result.put("projects", count("projects"));
        result.put("episodes", count("episodes"));
        result.put("assets", count("elements"));
        result.put("storyboards", count("storyboards"));
        result.put("queuedJobs", countWhere("generation_jobs", "status = 'queued'"));
        result.put("failedJobs", countWhere("generation_jobs", "status = 'failed'"));
        result.put("modelCalls", count("model_api_calls"));
        return result;
    }

    private long count(String table) {
        Long value = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
        return value == null ? 0L : value;
    }

    private long countWhere(String table, String where) {
        Long value = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM " + table + " WHERE " + where,
            Long.class
        );
        return value == null ? 0L : value;
    }
}
