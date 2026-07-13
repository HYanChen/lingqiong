package org.jeecg.modules.lingqiong.controller;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.jeecg.common.api.vo.Result;
import org.jeecg.modules.lingqiong.service.LingqiongDataCenterService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/lingqiong/data")
public class LingqiongDataCenterController {
    private final LingqiongDataCenterService service;

    public LingqiongDataCenterController(LingqiongDataCenterService service) {
        this.service = service;
    }

    @GetMapping("/modules")
    @RequiresPermissions("lingqiong:data:view")
    public Result<?> modules() {
        return Result.OK(service.modules().stream().map(module -> Map.of(
            "key", module.key(),
            "label", module.label(),
            "group", module.group(),
            "editable", !module.writeColumns().isEmpty(),
            "allowCreate", module.allowCreate(),
            "allowDelete", module.allowDelete()
        )).toList());
    }

    @GetMapping("/{module}/list")
    @RequiresPermissions("lingqiong:data:view")
    public Result<?> list(
        @PathVariable String module,
        @RequestParam(defaultValue = "1") Integer pageNo,
        @RequestParam(defaultValue = "20") Integer pageSize,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String projectId
    ) {
        try {
            return Result.OK(service.list(module, pageNo, pageSize, keyword, projectId));
        } catch (IllegalArgumentException exception) {
            return Result.error(exception.getMessage());
        }
    }

    @PostMapping("/{module}/save")
    @RequiresPermissions("lingqiong:data:edit")
    public Result<?> save(@PathVariable String module, @RequestBody Map<String, Object> input) {
        try {
            service.save(module, input);
            return Result.OK("保存成功");
        } catch (IllegalArgumentException exception) {
            return Result.error(exception.getMessage());
        }
    }

    @DeleteMapping("/{module}/delete")
    @RequiresPermissions("lingqiong:data:edit")
    public Result<?> delete(@PathVariable String module, @RequestParam String id) {
        try {
            service.delete(module, id);
            return Result.OK("删除成功");
        } catch (IllegalArgumentException exception) {
            return Result.error(exception.getMessage());
        }
    }
}
