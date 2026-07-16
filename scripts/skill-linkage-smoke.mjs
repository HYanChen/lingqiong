#!/usr/bin/env node

const baseUrl = (process.env.WCU_AUDIT_BASE_URL || "http://localhost").replace(/\/$/u, "");
const serviceSecret = process.env.LINGQIONG_SERVICE_SECRET || "zhanji-jeecg-service-local-secret";
const headers = {
  "content-type": "application/json",
  "x-lingqiong-service-secret": serviceSecret
};
const id = `skill-linkage-audit-${Date.now()}`;
let uploadedScriptPath = "";

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { body, response };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

const modules = [
  {
    accent: "blue",
    description: "验证后台模块可被前台完整读取。",
    id: `${id}-plan`,
    materials: ["用户目标", "项目名称"],
    nextStep: "进入执行模块。",
    order: "01",
    outputs: ["任务计划"],
    prompt: "输出一份任务计划。",
    reference: "SKILL.md",
    shortTitle: "制定计划",
    status: "可继续生产",
    title: "任务规划"
  },
  {
    accent: "green",
    description: "验证第二模块与排序保持一致。",
    id: `${id}-execute`,
    materials: ["任务计划"],
    nextStep: "完成验收。",
    order: "02",
    outputs: ["执行结果"],
    prompt: "根据计划输出执行结果。",
    reference: "references/audit.md",
    shortTitle: "执行任务",
    status: "待补材料",
    title: "任务执行"
  }
];

try {
  const invalid = await request("/_wcu-api/admin/skills", {
    body: JSON.stringify({ displayName: "无模块 Skill", id: `${id}-invalid`, modules: [] }),
    method: "POST"
  });
  assert(invalid.response.status === 400, "后台拒绝没有任务模块的错误配置");

  const created = await request("/_wcu-api/admin/skills", {
    body: JSON.stringify({
      active: true,
      category: "链路验收",
      description: "后台与前台 Skill 多模块链路临时验收数据。",
      displayName: "Skill 链路验收",
      id,
      modules,
      owner: "系统验收",
      source: "平台",
      triggerName: id,
      visibility: "public"
    }),
    method: "POST"
  });
  assert(created.response.ok && created.body.skill?.modules?.length === 2, "后台可保存两个完整任务模块");

  const userList = await request("/_wcu-api/skills");
  const visible = userList.body.skills?.find((skill) => skill.id === id);
  assert(userList.response.ok && visible, "用户端可读取后台新发布的 Skill");
  assert(visible.modules[0].title === "任务规划" && visible.modules[1].title === "任务执行", "用户端模块内容和顺序与后台一致");
  assert(visible.modules[1].materials[0] === "任务计划" && visible.modules[1].outputs[0] === "执行结果", "输入材料和输出结果完整同步");

  const anonymousUploadForm = new FormData();
  anonymousUploadForm.set("file", new Blob(["第一场：雨夜。"], { type: "text/plain" }), "未登录剧本.txt");
  const anonymousUpload = await fetch(`${baseUrl}/_wcu-api/skills/script-upload`, {
    body: anonymousUploadForm,
    method: "POST"
  });
  assert(anonymousUpload.status === 401, "未登录用户不能上传剧本");

  const invalidUploadForm = new FormData();
  invalidUploadForm.set("file", new Blob(["invalid"], { type: "application/octet-stream" }), "错误格式.exe");
  const invalidUpload = await fetch(`${baseUrl}/_wcu-api/skills/script-upload`, {
    body: invalidUploadForm,
    headers: { "x-lingqiong-service-secret": serviceSecret },
    method: "POST"
  });
  assert(invalidUpload.status === 415, "剧本上传拒绝不支持的文件格式");

  const uploadForm = new FormData();
  const scriptText = "第一场：雨夜。\n周北推门进入仓库。\n周北：时间到了。";
  uploadForm.set("file", new Blob([scriptText], { type: "text/plain" }), "链路验收剧本.txt");
  const uploadedResponse = await fetch(`${baseUrl}/_wcu-api/skills/script-upload`, {
    body: uploadForm,
    headers: { "x-lingqiong-service-secret": serviceSecret },
    method: "POST"
  });
  const uploadedBody = await uploadedResponse.json().catch(() => ({}));
  uploadedScriptPath = uploadedBody.upload?.path || "";
  assert(uploadedResponse.ok && uploadedBody.upload?.content === scriptText && uploadedScriptPath, "剧本文件可上传、提取正文并绑定账号工作区");

  const disabled = await request("/_wcu-api/admin/skills", {
    body: JSON.stringify({ ...visible, active: false }),
    method: "POST"
  });
  assert(disabled.response.ok && disabled.body.skill?.active === false, "后台可停用 Skill");

  const activeList = await request("/_wcu-api/skills");
  assert(!activeList.body.skills?.some((skill) => skill.id === id), "停用后用户端不再展示 Skill");
} finally {
  if (uploadedScriptPath) {
    const removedUpload = await fetch(
      `${baseUrl}/_wcu-api/skills/script-upload?path=${encodeURIComponent(uploadedScriptPath)}`,
      {
        headers: { "x-lingqiong-service-secret": serviceSecret },
        method: "DELETE"
      }
    );
    assert(removedUpload.ok, "验收剧本文件已从账号工作区清理");
  }
  const deleted = await request("/_wcu-api/admin/skills", {
    body: JSON.stringify({ id }),
    method: "DELETE"
  });
  assert(deleted.response.ok || deleted.response.status === 404, "验收数据已清理");
}

console.log("SKILL_LINKAGE_AUDIT_OK");
