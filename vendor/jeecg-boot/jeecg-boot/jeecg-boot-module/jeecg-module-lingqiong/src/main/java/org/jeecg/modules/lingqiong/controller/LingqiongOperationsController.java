package org.jeecg.modules.lingqiong.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.jeecg.common.api.vo.Result;
import org.jeecg.modules.lingqiong.entity.LingqiongFrontUser;
import org.jeecg.modules.lingqiong.entity.LingqiongGenerationJob;
import org.jeecg.modules.lingqiong.entity.LingqiongProject;
import org.jeecg.modules.lingqiong.mapper.LingqiongFrontUserMapper;
import org.jeecg.modules.lingqiong.mapper.LingqiongGenerationJobMapper;
import org.jeecg.modules.lingqiong.mapper.LingqiongProjectMapper;
import org.jeecg.modules.lingqiong.service.LingqiongOperationsService;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@Tag(name = "灵穹运营后台")
@RestController
@RequestMapping("/lingqiong")
public class LingqiongOperationsController {
    private final LingqiongOperationsService operationsService;
    private final LingqiongProjectMapper projectMapper;
    private final LingqiongFrontUserMapper userMapper;
    private final LingqiongGenerationJobMapper jobMapper;

    public LingqiongOperationsController(
        LingqiongOperationsService operationsService,
        LingqiongProjectMapper projectMapper,
        LingqiongFrontUserMapper userMapper,
        LingqiongGenerationJobMapper jobMapper
    ) {
        this.operationsService = operationsService;
        this.projectMapper = projectMapper;
        this.userMapper = userMapper;
        this.jobMapper = jobMapper;
    }

    @GetMapping("/dashboard/summary")
    @RequiresPermissions("lingqiong:dashboard:view")
    public Result<Map<String, Long>> summary() {
        return Result.OK(operationsService.summary());
    }

    @GetMapping("/projects/list")
    @RequiresPermissions("lingqiong:projects:list")
    public Result<Page<LingqiongProject>> projects(
        @RequestParam(defaultValue = "1") Integer pageNo,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String keyword
    ) {
        QueryWrapper<LingqiongProject> query = new QueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            query.and(value -> value.like("name", keyword.trim())
                .or().like("owner_account", keyword.trim()));
        }
        query.orderByDesc("updated_at");
        return Result.OK(projectMapper.selectPage(new Page<>(pageNo, pageSize), query));
    }

    @PutMapping("/projects/edit")
    @RequiresPermissions("lingqiong:projects:edit")
    public Result<?> editProject(@RequestBody LingqiongProject input) {
        LingqiongProject existing = projectMapper.selectById(input.getId());
        if (existing == null) {
            return Result.error("项目不存在");
        }
        existing.setName(input.getName());
        existing.setType(input.getType());
        existing.setAspectRatio(input.getAspectRatio());
        existing.setGoal(input.getGoal());
        existing.setStyle(input.getStyle());
        existing.setUpdatedAt(Instant.now().toString());
        projectMapper.updateById(existing);
        return Result.OK("项目已更新");
    }

    @GetMapping("/projects/{id}/flow")
    @RequiresPermissions("lingqiong:projects:list")
    public Result<?> projectFlow(@PathVariable String id) {
        try {
            return Result.OK(operationsService.projectFlow(id));
        } catch (IllegalArgumentException exception) {
            return Result.error(exception.getMessage());
        }
    }

    @GetMapping("/users/list")
    @RequiresPermissions("lingqiong:users:list")
    public Result<Page<LingqiongFrontUser>> users(
        @RequestParam(defaultValue = "1") Integer pageNo,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String keyword
    ) {
        QueryWrapper<LingqiongFrontUser> query = new QueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            query.and(value -> value.like("account", keyword.trim())
                .or().like("username", keyword.trim())
                .or().like("contact", keyword.trim()));
        }
        query.orderByDesc("created_at");
        return Result.OK(userMapper.selectPage(new Page<>(pageNo, pageSize), query));
    }

    @PutMapping("/users/edit")
    @RequiresPermissions("lingqiong:users:edit")
    public Result<?> editUser(@RequestBody LingqiongFrontUser input) {
        LingqiongFrontUser existing = userMapper.selectById(input.getId());
        if (existing == null) {
            return Result.error("用户不存在");
        }
        existing.setAccount(input.getAccount());
        existing.setContact(input.getContact());
        existing.setProfile(input.getProfile());
        existing.setActive(input.getActive() == null ? existing.getActive() : input.getActive());
        existing.setUpdatedAt(Instant.now().toString());
        userMapper.updateById(existing);
        return Result.OK("用户已更新");
    }

    @GetMapping("/jobs/list")
    @RequiresPermissions("lingqiong:jobs:list")
    public Result<Page<LingqiongGenerationJob>> jobs(
        @RequestParam(defaultValue = "1") Integer pageNo,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String status
    ) {
        QueryWrapper<LingqiongGenerationJob> query = new QueryWrapper<>();
        if (status != null && !status.isBlank()) {
            query.eq("status", status.trim());
        }
        query.orderByDesc("created_at");
        return Result.OK(jobMapper.selectPage(new Page<>(pageNo, pageSize), query));
    }

    @PutMapping("/jobs/{id}/retry")
    @RequiresPermissions("lingqiong:jobs:operate")
    public Result<?> retryJob(@PathVariable String id) {
        return jobMapper.retry(id, Instant.now().toString()) > 0
            ? Result.OK("任务已重新排队")
            : Result.error("任务不存在");
    }

    @PutMapping("/jobs/{id}/cancel")
    @RequiresPermissions("lingqiong:jobs:operate")
    public Result<?> cancelJob(@PathVariable String id) {
        return jobMapper.cancel(id, Instant.now().toString()) > 0
            ? Result.OK("任务已取消")
            : Result.error("仅排队中或执行中的任务可以取消");
    }
}
