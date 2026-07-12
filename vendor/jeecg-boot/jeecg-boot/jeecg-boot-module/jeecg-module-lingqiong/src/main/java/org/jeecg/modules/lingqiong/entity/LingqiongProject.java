package org.jeecg.modules.lingqiong.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.io.Serializable;

@Data
@Schema(description = "灵穹创作项目")
@TableName("projects")
public class LingqiongProject implements Serializable {
    @TableId(type = IdType.INPUT)
    private String id;
    @TableField("owner_id")
    private String ownerId;
    @TableField("owner_account")
    private String ownerAccount;
    private String name;
    private String type;
    @TableField("aspect_ratio")
    private String aspectRatio;
    @TableField("cover_image")
    private String coverImage;
    private String source;
    private String goal;
    private String style;
    @TableField("deliverables_json")
    private String deliverablesJson;
    @TableField("created_at")
    private String createdAt;
    @TableField("updated_at")
    private String updatedAt;
}
