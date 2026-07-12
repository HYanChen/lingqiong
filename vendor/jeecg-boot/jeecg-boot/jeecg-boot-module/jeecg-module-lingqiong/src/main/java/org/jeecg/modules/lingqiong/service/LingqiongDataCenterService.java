package org.jeecg.modules.lingqiong.service;

import com.baomidou.dynamic.datasource.annotation.DS;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@DS("lingqiong")
public class LingqiongDataCenterService {
    public record ModuleDefinition(
        String key,
        String label,
        String group,
        String table,
        List<String> searchColumns,
        Set<String> writeColumns,
        Set<String> hiddenColumns,
        String orderBy,
        boolean allowCreate,
        boolean allowDelete
    ) {
    }

    private static final Set<String> ALWAYS_HIDDEN = Set.of(
        "password_hash", "password_salt", "api_key", "client_secret",
        "access_token", "refresh_token", "code_challenge", "token"
    );

    private static Set<String> columns(String values) {
        if (values == null || values.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(values.split(","))
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static List<String> search(String values) {
        if (values == null || values.isBlank()) {
            return List.of();
        }
        return Arrays.stream(values.split(","))
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .toList();
    }

    private static ModuleDefinition module(
        String key,
        String label,
        String group,
        String table,
        String searchColumns,
        String writeColumns,
        String hiddenColumns,
        String orderBy,
        boolean allowCreate,
        boolean allowDelete
    ) {
        return new ModuleDefinition(
            key, label, group, table, search(searchColumns), columns(writeColumns),
            columns(hiddenColumns), orderBy, allowCreate, allowDelete
        );
    }

    private static final List<ModuleDefinition> MODULES = List.of(
        module("projectTypes", "项目类型", "项目生产", "project_types", "label,category,description", "slug,label,category,description,active,sort_order", "", "sort_order ASC", true, true),
        module("projects", "创作项目", "项目生产", "projects", "name,owner_account,type", "name,type,aspect_ratio,source,goal,style,deliverables_json", "cover_image", "updated_at DESC", false, false),
        module("episodes", "剧集与剧本", "项目生产", "episodes", "title,summary,status", "project_id,episode_number,title,summary,script,status,sort_order", "", "updated_at DESC", true, true),
        module("elements", "角色与资产", "项目生产", "elements", "name,kind,description,status", "project_id,episode_id,kind,name,aliases_json,prompt,description,notes,reference_image_url,voice_profile_id,status,sort_order", "", "updated_at DESC", true, true),
        module("storyboards", "分镜", "项目生产", "storyboards", "title,prompt,dialogue,status", "project_id,episode_id,shot_number,title,prompt,negative_prompt,dialogue,camera,duration_ms,element_ids_json,reference_image_url,image_url,video_url,status,sort_order", "", "updated_at DESC", true, true),
        module("voiceovers", "配音", "项目生产", "voiceovers", "speaker_name,line_text,status", "project_id,episode_id,storyboard_id,role_element_id,line_text,speaker_name,voice_profile_id,audio_url,duration_ms,status,sort_order", "", "updated_at DESC", true, true),
        module("compositions", "合成任务", "项目生产", "compositions", "project_id,status", "project_id,episode_id,timeline_json,settings_json,output_url,status,revision", "", "updated_at DESC", true, true),
        module("uploads", "项目素材", "项目生产", "project_uploads", "file_name,owner_account,file_type", "", "storage_path", "created_at DESC", false, false),
        module("generationJobs", "生成任务", "项目生产", "generation_jobs", "task_type,status,created_by_account,error", "", "input_json,output_json", "created_at DESC", false, false),

        module("frontUsers", "前台用户", "用户账务", "front_users", "username,account,contact,source", "account,contact,profile,active,locked_until", "password_hash,password_salt", "created_at DESC", false, false),
        module("identities", "第三方身份绑定", "用户账务", "front_user_identities", "provider,provider_subject,user_id", "", "provider_subject", "created_at DESC", false, false),
        module("inviteCodes", "邀请码", "用户账务", "invite_codes", "code,label", "", "", "created_at DESC", false, false),
        module("apiAccounts", "灵穹 API 账号映射", "用户账务", "api_account_links", "principal_id,oidc_subject,link_status", "", "oidc_subject,internal_token_id", "updated_at DESC", false, false),
        module("billingAudits", "模型账单", "用户账务", "model_billing_audits", "principal_id,capability,model,status,error_code", "", "new_api_token_id", "created_at DESC", false, false),

        module("modelConfigs", "模型配置", "模型技能", "model_api_configs", "name,provider,model,base_url", "", "api_key,system_prompt", "updated_at DESC", false, false),
        module("modelCalls", "模型调用记录", "模型技能", "model_api_calls", "actor_account,project_name,node_title,status", "", "prompt,response_text", "created_at DESC", false, false),
        module("skills", "Skill 工具", "模型技能", "skill_tools", "display_name,trigger_name,category,owner", "display_name,trigger_name,category,owner,description,source,visibility,active,modules_json,package_json", "package_json", "updated_at DESC", true, true),
        module("skillRuns", "Skill 运行记录", "模型技能", "skill_runs", "skill_name,module_title,project_name,status,model", "", "input_text,output_text,error", "created_at DESC", false, false),
        module("skillSessions", "Skill 会话", "模型技能", "skill_chat_sessions", "title,project_name", "", "", "updated_at DESC", false, false),
        module("skillMessages", "Skill 消息", "模型技能", "skill_chat_messages", "role,status,model", "", "content,error", "created_at DESC", false, false),
        module("skillFiles", "Skill 文件", "模型技能", "skill_chat_files", "file_name,source", "", "relative_path", "created_at DESC", false, false),

        module("knowledgeSpaces", "知识空间", "知识库", "knowledge_spaces", "title,description,owner_account", "owner_id,owner_account,title,description,icon,color,revision", "", "updated_at DESC", true, true),
        module("knowledgePages", "知识页面", "知识库", "knowledge_pages", "title,slug,page_type", "space_id,parent_id,title,slug,page_type,icon,content_json,sort_order,revision,deleted_at,deleted_by_account,deleted_by_id,deleted_root_id,deletion_batch_id", "content_json", "updated_at DESC", true, true),
        module("knowledgeTables", "多维表格", "知识库", "knowledge_tables", "title,description", "space_id,title,description,icon,revision,deleted_at,deleted_by_account,deleted_by_id,deleted_root_id,deletion_batch_id", "", "updated_at DESC", true, true),
        module("knowledgeFields", "表格字段", "知识库", "knowledge_fields", "name,field_type", "table_id,name,field_type,config_json,sort_order,revision", "config_json", "sort_order ASC", true, true),
        module("knowledgeRecords", "表格记录", "知识库", "knowledge_records", "created_by_account,updated_by_account", "table_id,values_json,sort_order,revision,created_by_id,created_by_account,updated_by_id,updated_by_account", "values_json", "updated_at DESC", true, true),
        module("knowledgeViews", "表格视图", "知识库", "knowledge_views", "name,view_type", "table_id,name,view_type,filter_json,sort_json,group_json,visible_field_ids_json,row_height,frozen_field_count,is_default,revision", "filter_json,sort_json,group_json,visible_field_ids_json", "created_at ASC", true, true),
        module("spaceMembers", "空间成员", "知识库", "knowledge_space_members", "account,member_role", "space_id,user_id,account,member_role,revision,added_by_id,added_by_account", "", "created_at DESC", true, true),
        module("pageComments", "页面评论", "知识库", "knowledge_page_comments", "author_account,body,status", "space_id,page_id,parent_comment_id,author_id,author_account,body,status,revision", "", "created_at DESC", true, true),
        module("pageVersions", "页面版本", "知识库", "knowledge_page_versions", "title,created_by_account,change_summary", "", "content_json", "created_at DESC", false, false),
        module("recordComments", "记录评论", "知识库", "knowledge_record_comments", "author_account,body,status", "table_id,record_id,parent_comment_id,author_id,author_account,body,status,revision", "", "created_at DESC", true, true),
        module("recordActivities", "记录动态", "知识库", "knowledge_record_activities", "actor_account,action", "", "details_json", "created_at DESC", false, false),
        module("recordAttachments", "记录附件", "知识库", "knowledge_record_attachments", "file_name,mime_type,uploaded_by_account", "", "storage_name", "created_at DESC", false, false),
        module("automationRules", "自动化规则", "知识库", "knowledge_automation_rules", "name,trigger_type,created_by_account", "table_id,name,trigger_type,trigger_config_json,conditions_json,actions_json,enabled,revision,created_by_id,created_by_account", "trigger_config_json,conditions_json,actions_json", "updated_at DESC", true, true),
        module("automationRuns", "自动化运行", "知识库", "knowledge_automation_runs", "status,error_text", "", "trigger_payload_json,result_json", "created_at DESC", false, false),

        module("adminAudit", "后台审计", "系统审计", "admin_audit_logs", "actor_username,action,target_type,target_id", "", "details_json,ip_address,user_agent", "created_at DESC", false, false),
        module("usageBuckets", "模型限额窗口", "系统审计", "model_api_usage_buckets", "config_id,actor_key,window_type", "", "actor_key", "updated_at DESC", false, false),
        module("concurrencyLeases", "并发租约", "系统审计", "model_api_concurrency_leases", "config_id,actor_key", "", "actor_key", "created_at DESC", false, false),
        module("wechatTickets", "微信登录票据", "系统审计", "wechat_login_tickets", "status,scanned_account", "", "code,scanned_contact", "created_at DESC", false, false),
        module("oidcCodes", "OIDC 授权码", "系统审计", "oidc_authorization_codes", "id", "", "id", "created_at DESC", false, false)
    );

    private final JdbcTemplate jdbcTemplate;

    public LingqiongDataCenterService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ModuleDefinition> modules() {
        return MODULES;
    }

    public ModuleDefinition requireModule(String key) {
        return MODULES.stream()
            .filter(module -> module.key().equals(key))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("不支持的数据模块"));
    }

    public Map<String, Object> list(String key, int pageNo, int pageSize, String keyword) {
        ModuleDefinition module = requireModule(key);
        int safePage = Math.max(1, pageNo);
        int safeSize = Math.max(1, Math.min(100, pageSize));
        int offset = (safePage - 1) * safeSize;
        List<Object> args = new ArrayList<>();
        String where = "";

        if (keyword != null && !keyword.isBlank() && !module.searchColumns().isEmpty()) {
            String expression = module.searchColumns().stream()
                .map(column -> "CAST(`" + column + "` AS CHAR)")
                .collect(Collectors.joining(","));
            where = " WHERE CONCAT_WS(' '," + expression + ") LIKE ?";
            args.add("%" + keyword.trim() + "%");
        }

        Long total = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM `" + module.table() + "`" + where,
            Long.class,
            args.toArray()
        );
        List<Object> listArgs = new ArrayList<>(args);
        listArgs.add(safeSize);
        listArgs.add(offset);
        List<Map<String, Object>> records = jdbcTemplate.queryForList(
            "SELECT * FROM `" + module.table() + "`" + where +
                " ORDER BY " + module.orderBy() + " LIMIT ? OFFSET ?",
            listArgs.toArray()
        );
        records.forEach(record -> hiddenColumns(module).forEach(record::remove));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("module", publicModule(module));
        result.put("columns", columnMetadata(module));
        result.put("records", records);
        result.put("total", total == null ? 0L : total);
        result.put("pageNo", safePage);
        result.put("pageSize", safeSize);
        return result;
    }

    public void save(String key, Map<String, Object> input) {
        ModuleDefinition module = requireModule(key);
        if (module.writeColumns().isEmpty()) {
            throw new IllegalArgumentException("该模块为只读模块");
        }

        Map<String, Map<String, Object>> metadata = columnMetadata(module).stream()
            .collect(Collectors.toMap(
                column -> String.valueOf(column.get("name")),
                column -> column
            ));
        String id = input.get("id") == null ? "" : String.valueOf(input.get("id")).trim();
        boolean creating = id.isBlank();
        Map<String, Object> values = new LinkedHashMap<>();

        for (String column : module.writeColumns()) {
            if (metadata.containsKey(column) && input.containsKey(column)) {
                values.put(column, input.get(column));
            }
        }

        String now = Instant.now().toString();
        if (metadata.containsKey("updated_at")) {
            values.put("updated_at", now);
        }

        if (creating) {
            if (!module.allowCreate()) {
                throw new IllegalArgumentException("该模块不允许新增");
            }
            if (metadata.containsKey("id")) {
                values.put("id", UUID.randomUUID().toString());
            }
            if (metadata.containsKey("created_at")) {
                values.put("created_at", now);
            }
            if (values.isEmpty()) {
                throw new IllegalArgumentException("没有可保存的字段");
            }
            String names = values.keySet().stream()
                .map(name -> "`" + name + "`")
                .collect(Collectors.joining(","));
            String placeholders = values.keySet().stream().map(name -> "?")
                .collect(Collectors.joining(","));
            jdbcTemplate.update(
                "INSERT INTO `" + module.table() + "` (" + names + ") VALUES (" + placeholders + ")",
                values.values().toArray()
            );
            return;
        }

        if (values.isEmpty()) {
            throw new IllegalArgumentException("没有可保存的字段");
        }
        String assignments = values.keySet().stream()
            .map(name -> "`" + name + "` = ?")
            .collect(Collectors.joining(","));
        List<Object> updateArgs = new ArrayList<>(values.values());
        updateArgs.add(id);
        int updated = jdbcTemplate.update(
            "UPDATE `" + module.table() + "` SET " + assignments + " WHERE id = ?",
            updateArgs.toArray()
        );
        if (updated < 1) {
            throw new IllegalArgumentException("记录不存在");
        }
    }

    public void delete(String key, String id) {
        ModuleDefinition module = requireModule(key);
        if (!module.allowDelete()) {
            throw new IllegalArgumentException("该模块不允许删除");
        }
        if (jdbcTemplate.update("DELETE FROM `" + module.table() + "` WHERE id = ?", id) < 1) {
            throw new IllegalArgumentException("记录不存在");
        }
    }

    private Set<String> hiddenColumns(ModuleDefinition module) {
        Set<String> hidden = new LinkedHashSet<>(ALWAYS_HIDDEN);
        hidden.addAll(module.hiddenColumns());
        return hidden;
    }

    private Map<String, Object> publicModule(ModuleDefinition module) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("key", module.key());
        result.put("label", module.label());
        result.put("group", module.group());
        result.put("editable", !module.writeColumns().isEmpty());
        result.put("allowCreate", module.allowCreate());
        result.put("allowDelete", module.allowDelete());
        return result;
    }

    private List<Map<String, Object>> columnMetadata(ModuleDefinition module) {
        Set<String> hidden = hiddenColumns(module);
        return jdbcTemplate.queryForList("SHOW COLUMNS FROM `" + module.table() + "`").stream()
            .filter(column -> !hidden.contains(String.valueOf(column.get("Field"))))
            .map(column -> {
                String name = String.valueOf(column.get("Field"));
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("name", name);
                result.put("type", String.valueOf(column.get("Type")));
                result.put("nullable", "YES".equals(String.valueOf(column.get("Null"))));
                result.put("primary", "PRI".equals(String.valueOf(column.get("Key"))));
                result.put("editable", module.writeColumns().contains(name));
                return result;
            })
            .toList();
    }
}
