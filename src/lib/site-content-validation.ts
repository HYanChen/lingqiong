import type { IconKey, SiteData } from "@/content/site";
import { safeInternalRedirectPath } from "@/lib/safe-redirect";

const MAX_SITE_CONTENT_BYTES = 1024 * 1024;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const unsafeUrlPattern = /[\\\u0000-\u001f\u007f]/u;
const iconKeys = new Set<IconKey>([
  "BookOpen",
  "Boxes",
  "Building2",
  "Clapperboard",
  "Compass",
  "Film",
  "Flame",
  "Layers3",
  "PenTool",
  "PlaySquare",
  "Radio",
  "ScrollText",
  "ShieldCheck",
  "Sparkles",
  "UsersRound",
  "WandSparkles"
]);

type ValidationResult =
  | { data: SiteData; ok: true }
  | { message: string; ok: false; status: 400 | 413 };

class SiteContentValidationError extends Error {
  status: 400 | 413;

  constructor(message: string, status: 400 | 413 = 400) {
    super(message);
    this.status = status;
  }
}

function fail(message: string, status: 400 | 413 = 400): never {
  throw new SiteContentValidationError(message, status);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label}格式不正确`);
  }

  return value as Record<string, unknown>;
}

function array(value: unknown, label: string, maxItems: number) {
  if (!Array.isArray(value) || value.length > maxItems) {
    fail(`${label}格式不正确或数量超过 ${maxItems} 项`);
  }

  return value;
}

function text(
  value: unknown,
  label: string,
  options: { max: number; required?: boolean }
) {
  if (typeof value !== "string") {
    fail(`${label}必须是文本`);
  }

  const normalized = value.trim();

  if (options.required && !normalized) {
    fail(`${label}不能为空`);
  }

  if (value.length > options.max) {
    fail(`${label}不能超过 ${options.max} 个字符`);
  }

  return value;
}

function stringList(
  value: unknown,
  label: string,
  options: { maxItems?: number; maxItem?: number; maxTotal?: number } = {}
) {
  const values = array(value, label, options.maxItems ?? 40);
  let total = 0;

  for (const [index, item] of values.entries()) {
    const current = text(item, `${label}第 ${index + 1} 项`, {
      max: options.maxItem ?? 300,
      required: true
    });
    total += current.length;
  }

  if (total > (options.maxTotal ?? 8000)) {
    fail(`${label}总长度过长`);
  }

  return values as string[];
}

function icon(value: unknown, label: string) {
  if (typeof value !== "string" || !iconKeys.has(value as IconKey)) {
    fail(`${label}不是支持的图标`);
  }
}

function decodedUrl(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function pointsToAdminPath(value: string) {
  try {
    const url = new URL(value, "https://public-navigation.invalid");
    let pathname = url.pathname;

    for (let index = 0; index < 2; index += 1) {
      try {
        pathname = decodeURIComponent(pathname);
      } catch {
        break;
      }
    }

    pathname = pathname.replace(/\/{2,}/gu, "/").replace(/\/+$/u, "") || "/";
    return pathname === "/admin" || pathname.startsWith("/admin/");
  } catch {
    return false;
  }
}

function safeHttpUrl(value: string, label: string) {
  try {
    const url = new URL(value);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.hash
    ) {
      fail(`${label}只支持无账号信息的 http(s) 地址`);
    }
  } catch (error) {
    if (error instanceof SiteContentValidationError) {
      throw error;
    }

    fail(`${label}不是有效网址`);
  }
}

function href(value: unknown, label: string) {
  const current = text(value, label, { max: 500, required: true }).trim();
  const decoded = decodedUrl(current);

  if (!decoded || unsafeUrlPattern.test(current) || unsafeUrlPattern.test(decoded)) {
    fail(`${label}包含不安全字符`);
  }

  if (current.startsWith("/")) {
    if (!safeInternalRedirectPath(current, "")) {
      fail(`${label}不是安全的站内路径`);
    }

    if (pointsToAdminPath(decoded)) {
      fail(`${label}不能指向管理员后台`);
    }

    return;
  }

  safeHttpUrl(current, label);

  if (pointsToAdminPath(decoded)) {
    fail(`${label}不能指向管理员后台`);
  }
}

function mediaPath(
  value: unknown,
  label: string,
  options: { allowEmpty?: boolean; allowRemote?: boolean } = {}
) {
  const current = text(value, label, { max: 1000 }).trim();

  if (!current && options.allowEmpty) {
    return;
  }

  if (!current) {
    fail(`${label}不能为空`);
  }

  const decoded = decodedUrl(current);

  if (!decoded || unsafeUrlPattern.test(current) || unsafeUrlPattern.test(decoded)) {
    fail(`${label}包含不安全字符`);
  }

  if (current.startsWith("/media/") && safeInternalRedirectPath(current, "")) {
    return;
  }

  if (options.allowRemote) {
    safeHttpUrl(current, label);
    return;
  }

  fail(`${label}必须使用 /media/ 站内资源路径`);
}

function uniqueSlug(value: unknown, label: string, used: Set<string>) {
  const current = text(value, label, { max: 80, required: true }).trim();

  if (!slugPattern.test(current)) {
    fail(`${label}只能使用小写字母、数字和单个连字符`);
  }

  if (used.has(current)) {
    fail(`${label}“${current}”重复`);
  }

  used.add(current);
}

function validateSiteData(value: unknown): SiteData {
  const root = record(value, "官网内容");
  const brand = record(root.brand, "品牌资料");
  text(brand.name, "品牌名称", { max: 80, required: true });
  text(brand.english, "品牌英文名", { max: 160, required: true });
  text(brand.tagline, "品牌标语", { max: 500, required: true });
  text(brand.description, "品牌说明", { max: 5000 });

  const company = record(root.company, "公司资料");
  text(company.name, "公司简称", { max: 120, required: true });
  text(company.legalName, "公司全称", { max: 255, required: true });
  text(company.role, "公司定位", { max: 500, required: true });
  const contact = record(company.contact, "联系方式");
  text(contact.email, "联系邮箱", { max: 255 });
  text(contact.phone, "联系电话", { max: 80 });
  text(contact.wechat, "联系微信", { max: 120 });

  for (const [index, item] of array(root.navItems, "导航", 30).entries()) {
    const current = record(item, `第 ${index + 1} 个导航`);
    text(current.label, `第 ${index + 1} 个导航名称`, {
      max: 80,
      required: true
    });
    href(current.href, `第 ${index + 1} 个导航地址`);
  }

  const media = record(root.media, "媒体资源");
  for (const key of ["hero", "spark", "workflow", "generations", "services"] as const) {
    mediaPath(media[key], `媒体资源 ${key}`);
  }
  mediaPath(media.heroVideo, "首屏视频", { allowEmpty: true, allowRemote: true });

  for (const [index, item] of array(root.universeChapters, "世界观章节", 50).entries()) {
    const current = record(item, `第 ${index + 1} 个世界观章节`);
    text(current.title, `第 ${index + 1} 个章节标题`, { max: 160, required: true });
    text(current.period, `第 ${index + 1} 个章节阶段`, { max: 160, required: true });
    text(current.summary, `第 ${index + 1} 个章节说明`, { max: 3000, required: true });
    icon(current.icon, `第 ${index + 1} 个章节图标`);
  }

  const workSlugs = new Set<string>();
  for (const [index, item] of array(root.works, "作品", 100).entries()) {
    const current = record(item, `第 ${index + 1} 个作品`);
    uniqueSlug(current.slug, `第 ${index + 1} 个作品 slug`, workSlugs);
    text(current.title, `第 ${index + 1} 个作品标题`, { max: 255, required: true });
    text(current.category, `第 ${index + 1} 个作品分类`, { max: 120, required: true });
    text(current.status, `第 ${index + 1} 个作品状态`, { max: 120, required: true });
    text(current.format, `第 ${index + 1} 个作品形态`, { max: 160, required: true });
    text(current.logline, `第 ${index + 1} 个作品简介`, { max: 3000, required: true });
    mediaPath(current.image, `第 ${index + 1} 个作品图片`);
    stringList(current.tags, `第 ${index + 1} 个作品标签`, { maxItems: 30, maxItem: 80 });
    stringList(current.deliverables, `第 ${index + 1} 个作品交付物`, {
      maxItems: 50,
      maxItem: 200
    });
  }

  for (const [index, item] of array(root.pipelineSteps, "生产步骤", 50).entries()) {
    const current = record(item, `第 ${index + 1} 个生产步骤`);
    text(current.title, `第 ${index + 1} 个步骤标题`, { max: 160, required: true });
    text(current.eyebrow, `第 ${index + 1} 个步骤编号`, { max: 80, required: true });
    text(current.summary, `第 ${index + 1} 个步骤说明`, { max: 3000, required: true });
    text(current.output, `第 ${index + 1} 个步骤输出`, { max: 1000, required: true });
    icon(current.icon, `第 ${index + 1} 个步骤图标`);
  }

  for (const [index, item] of array(root.services, "服务", 100).entries()) {
    const current = record(item, `第 ${index + 1} 个服务`);
    text(current.title, `第 ${index + 1} 个服务标题`, { max: 160, required: true });
    text(current.audience, `第 ${index + 1} 个服务客户`, { max: 500, required: true });
    text(current.summary, `第 ${index + 1} 个服务说明`, { max: 3000, required: true });
    text(current.timeline, `第 ${index + 1} 个服务周期`, { max: 120, required: true });
    stringList(current.deliverables, `第 ${index + 1} 个服务交付物`, {
      maxItems: 50,
      maxItem: 200
    });
    icon(current.icon, `第 ${index + 1} 个服务图标`);
  }

  const memberSlugs = new Set<string>();
  for (const [index, item] of array(root.teamMembers, "团队成员", 100).entries()) {
    const current = record(item, `第 ${index + 1} 位成员`);
    text(current.name, `第 ${index + 1} 位成员姓名`, { max: 80, required: true });
    text(current.role, `第 ${index + 1} 位成员岗位`, { max: 120, required: true });

    text(current.group, `第 ${index + 1} 位成员分组`, {
      max: 80,
      required: true
    });

    uniqueSlug(current.slug, `第 ${index + 1} 位成员 slug`, memberSlugs);
    text(current.bio, `第 ${index + 1} 位成员简介`, { max: 5000 });
    mediaPath(current.avatar, `第 ${index + 1} 位成员照片`, {
      allowEmpty: true,
      allowRemote: true
    });
    stringList(current.expertise, `第 ${index + 1} 位成员专业方向`, {
      maxItems: 30,
      maxItem: 300,
      maxTotal: 5000
    });
    stringList(current.highlights, `第 ${index + 1} 位成员履历亮点`, {
      maxItems: 30,
      maxItem: 300,
      maxTotal: 5000
    });
  }

  stringList(root.proofPoints, "证明点", {
    maxItems: 100,
    maxItem: 300,
    maxTotal: 12000
  });

  const copyKeys = new Set<string>();
  for (const [index, item] of array(root.siteCopy, "页面文案", 500).entries()) {
    const current = record(item, `第 ${index + 1} 条页面文案`);
    const key = text(current.key, `第 ${index + 1} 条页面文案键`, {
      max: 160,
      required: true
    }).trim();

    if (!/^[a-z][a-z0-9]*(?:\.[a-zA-Z0-9]+)+$/u.test(key)) {
      fail(`第 ${index + 1} 条页面文案键格式不正确`);
    }

    if (copyKeys.has(key)) {
      fail(`页面文案键“${key}”重复`);
    }

    copyKeys.add(key);
    text(current.group, `第 ${index + 1} 条页面文案分组`, {
      max: 80,
      required: true
    });
    text(current.label, `第 ${index + 1} 条页面文案名称`, {
      max: 160,
      required: true
    });
    const value = text(current.value, `第 ${index + 1} 条页面文案内容`, {
      max: 20000
    });

    if (key.endsWith("Href")) {
      href(value, `第 ${index + 1} 条页面文案链接`);
    }

    if (current.multiline !== undefined && typeof current.multiline !== "boolean") {
      fail(`第 ${index + 1} 条页面文案多行标记格式不正确`);
    }
  }

  return value as SiteData;
}

export function validateSiteContent(value: unknown): ValidationResult {
  try {
    const serialized = JSON.stringify(value);

    if (!serialized) {
      fail("官网内容格式不正确");
    }

    if (Buffer.byteLength(serialized, "utf8") > MAX_SITE_CONTENT_BYTES) {
      fail("官网内容总大小不能超过 1MB", 413);
    }

    return { data: validateSiteData(value), ok: true };
  } catch (error) {
    if (error instanceof SiteContentValidationError) {
      return { message: error.message, ok: false, status: error.status };
    }

    return { message: "官网内容格式不正确", ok: false, status: 400 };
  }
}
