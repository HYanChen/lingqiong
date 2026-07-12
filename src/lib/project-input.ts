const MAX_PROJECT_BODY_BYTES = 1024 * 1024;

export type ProjectMutationInput = {
  aspectRatio?: string;
  coverImage?: string;
  deliverables?: string[];
  goal?: string;
  name?: string;
  ownerAccount?: string;
  ownerId?: string;
  source?: string;
  style?: string;
  type?: string;
};

export class ProjectInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProjectInputError";
    this.status = status;
  }
}

function optionalString(
  value: unknown,
  field: string,
  maxLength: number,
  options: { trim?: boolean } = {}
) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ProjectInputError(`${field}格式不正确。`);
  }

  const normalized = options.trim === false ? value : value.trim();

  if (normalized.length > maxLength) {
    throw new ProjectInputError(`${field}不能超过 ${maxLength} 个字符。`);
  }

  return normalized;
}

function coverImageValue(value: unknown) {
  const coverImage = optionalString(value, "封面地址", 2048);

  if (!coverImage) {
    return coverImage;
  }

  if (coverImage.startsWith("/") && !coverImage.startsWith("//")) {
    return coverImage;
  }

  try {
    const url = new URL(coverImage);

    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    ) {
      return coverImage;
    }
  } catch {
    // Handled by the validation error below.
  }

  throw new ProjectInputError("封面地址仅支持 http(s) 或站内绝对路径。");
}

function deliverablesValue(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length > 50) {
    throw new ProjectInputError("交付物最多填写 50 项。");
  }

  const deliverables = value.map((item) => {
    if (typeof item !== "string") {
      throw new ProjectInputError("交付物格式不正确。");
    }

    const normalized = item.trim();

    if (!normalized || normalized.length > 500) {
      throw new ProjectInputError("单项交付物需为 1-500 个字符。");
    }

    return normalized;
  });

  if (deliverables.reduce((total, item) => total + item.length, 0) > 10_000) {
    throw new ProjectInputError("交付物总长度不能超过 10000 个字符。");
  }

  return deliverables;
}

export async function readProjectMutationInput(
  request: Request,
  options: { creating: boolean }
) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_PROJECT_BODY_BYTES) {
    throw new ProjectInputError("项目请求内容不能超过 1MB。", 413);
  }

  const text = await request.text();

  if (Buffer.byteLength(text, "utf8") > MAX_PROJECT_BODY_BYTES) {
    throw new ProjectInputError("项目请求内容不能超过 1MB。", 413);
  }

  let body: unknown;

  try {
    body = JSON.parse(text);
  } catch {
    throw new ProjectInputError("项目请求不是有效的 JSON。");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProjectInputError("项目请求内容为空或格式不正确。");
  }

  const input = body as Record<string, unknown>;
  const name = optionalString(input.name, "项目名称", 255);

  if (options.creating && !name) {
    throw new ProjectInputError("请填写项目名称。");
  }

  if (input.name !== undefined && !name) {
    throw new ProjectInputError("项目名称不能为空。");
  }

  return {
    aspectRatio: optionalString(input.aspectRatio, "画幅比例", 20),
    coverImage: coverImageValue(input.coverImage),
    deliverables: deliverablesValue(input.deliverables),
    goal: optionalString(input.goal, "项目目标", 50_000, { trim: false }),
    name,
    ownerAccount: optionalString(input.ownerAccount, "项目所有者账号", 255),
    ownerId: optionalString(input.ownerId, "项目所有者 ID", 191),
    source: optionalString(input.source, "项目素材", 300_000, { trim: false }),
    style: optionalString(input.style, "项目风格", 50_000, { trim: false }),
    type: optionalString(input.type, "项目类型", 120)
  } satisfies ProjectMutationInput;
}
