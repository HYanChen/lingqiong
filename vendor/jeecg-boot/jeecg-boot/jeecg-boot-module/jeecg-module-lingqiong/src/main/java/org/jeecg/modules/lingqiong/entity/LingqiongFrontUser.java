package org.jeecg.modules.lingqiong.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.io.Serializable;

@Data
@Schema(description = "灵穹前台用户")
@TableName("front_users")
public class LingqiongFrontUser implements Serializable {
    @TableId(type = IdType.INPUT)
    private String id;
    private String username;
    private String account;
    private String contact;
    private String profile;
    @TableField("invite_code")
    private String inviteCode;
    private String source;
    private Integer active;
    @TableField("failed_attempts")
    private Integer failedAttempts;
    @TableField("locked_until")
    private String lockedUntil;
    @TableField("last_login_at")
    private String lastLoginAt;
    @TableField("created_at")
    private String createdAt;
    @TableField("updated_at")
    private String updatedAt;
}
