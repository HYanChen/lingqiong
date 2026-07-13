package org.jeecg.modules.lingqiong.service;

import com.baomidou.dynamic.datasource.annotation.DS;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
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

    public Map<String, Object> projectFlow(String projectId) {
        List<Map<String, Object>> projects = jdbcTemplate.queryForList(
            "SELECT id, name, owner_account, type, aspect_ratio, updated_at " +
                "FROM projects WHERE id = ? LIMIT 1",
            projectId
        );
        if (projects.isEmpty()) {
            throw new IllegalArgumentException("项目不存在");
        }

        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("episodes", countByProject("episodes", projectId));
        counts.put("elements", countByProject("elements", projectId));
        counts.put("storyboards", countByProject("storyboards", projectId));
        counts.put("voiceovers", countByProject("voiceovers", projectId));
        counts.put("compositions", countByProject("compositions", projectId));
        counts.put("uploads", countByProject("project_uploads", projectId));
        counts.put("generationJobs", countByProject("generation_jobs", projectId));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("project", projects.get(0));
        result.put("counts", counts);
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

    private long countByProject(String table, String projectId) {
        Long value = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM " + table + " WHERE project_id = ?",
            Long.class,
            projectId
        );
        return value == null ? 0L : value;
    }
}
