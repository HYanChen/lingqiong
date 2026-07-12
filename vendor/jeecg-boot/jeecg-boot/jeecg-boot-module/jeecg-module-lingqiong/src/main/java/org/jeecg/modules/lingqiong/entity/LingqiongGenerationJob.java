package org.jeecg.modules.lingqiong.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.io.Serializable;

@Data
@Schema(description = "灵穹生成任务")
@TableName("generation_jobs")
public class LingqiongGenerationJob implements Serializable {
    @TableId(type = IdType.INPUT)
    private String id;
    @TableField("project_id")
    private String projectId;
    @TableField("episode_id")
    private String episodeId;
    @TableField("resource_type")
    private String resourceType;
    @TableField("resource_id")
    private String resourceId;
    @TableField("task_type")
    private String taskType;
    private String status;
    private String error;
    @TableField("model_config_id")
    private String modelConfigId;
    @TableField("created_by_account")
    private String createdByAccount;
    @TableField("attempt_count")
    private Integer attemptCount;
    @TableField("created_at")
    private String createdAt;
    @TableField("updated_at")
    private String updatedAt;
}
