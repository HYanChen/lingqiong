import { randomUUID } from "node:crypto";
import path from "node:path";

import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { getPath as getPdfWorkerPath } from "pdf-parse/worker";

import { requirePlatformUser } from "@/lib/auth-guards";
import {
  deleteSkillWorkspacePath,
  saveSkillWorkspaceBinaryFile
} from "@/lib/skill-chat";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 120_000;
const UPLOAD_DIRECTORY = "uploads/scripts";
const supportedExtensions = new Set([".docx", ".md", ".pdf", ".txt"]);

PDFParse.setWorker(getPdfWorkerPath());

type ExtractedScript = {
  characterCount: number;
  content: string;
  truncated: boolean;
  warnings: string[];
};

function safeOriginalName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  const stem = path
    .basename(fileName, extension)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${stem || "script"}${extension}`;
}

function hasPrefix(buffer: Buffer, signature: number[]) {
  return signature.every((value, index) => buffer[index] === value);
}

function validateSignature(extension: string, buffer: Buffer) {
  if (extension === ".pdf" && !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("PDF 文件签名无效，请重新导出后上传。");
  }

  if (extension === ".docx" && !hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    throw new Error("DOCX 文件签名无效，请上传 Word 的 .docx 文件。");
  }
}

function limitExtractedText(rawText: string, warnings: string[] = []): ExtractedScript {
  const normalized = rawText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (normalized.includes("\u0000")) {
    throw new Error("文件包含无法识别的二进制内容。");
  }

  const characterCount = normalized.length;
  const truncated = characterCount > MAX_EXTRACTED_CHARACTERS;

  return {
    characterCount,
    content: truncated ? normalized.slice(0, MAX_EXTRACTED_CHARACTERS) : normalized,
    truncated,
    warnings: truncated
      ? [...warnings, `文本超过 ${MAX_EXTRACTED_CHARACTERS.toLocaleString("zh-CN")} 字，本次任务读取前部内容。`]
      : warnings
  };
}

async function extractScript(extension: string, buffer: Buffer): Promise<ExtractedScript> {
  if (extension === ".txt" || extension === ".md") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return limitExtractedText(text);
  }

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return limitExtractedText(
      result.value,
      result.messages.map((message) => message.message).filter(Boolean)
    );
  }

  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    return limitExtractedText(result.text);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function scriptUploadPathIsAllowed(filePath: string) {
  const normalized = filePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized.startsWith(`${UPLOAD_DIRECTORY}/`) && !normalized.includes("../");
}

export async function POST(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json(
      { message: "请使用剧本上传表单。", ok: false },
      { status: 415 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES + 64 * 1024) {
    return NextResponse.json(
      { message: "单个剧本文件不能超过 20MB。", ok: false },
      { status: 413 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json(
      { message: "请选择要上传的剧本文件。", ok: false },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { message: "单个剧本文件不能超过 20MB。", ok: false },
      { status: 413 }
    );
  }

  const extension = path.extname(file.name).toLowerCase();

  if (!supportedExtensions.has(extension)) {
    return NextResponse.json(
      { message: "仅支持 TXT、Markdown、DOCX 和 PDF 剧本。", ok: false },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    validateSignature(extension, buffer);
    const extracted = await extractScript(extension, buffer);

    if (!extracted.content) {
      return NextResponse.json(
        { message: "没有从文件中读取到可用文字，请检查文件内容。", ok: false },
        { status: 422 }
      );
    }

    const originalName = safeOriginalName(file.name);
    const storedName = `${randomUUID()}-${originalName}`;
    const savedFile = await saveSkillWorkspaceBinaryFile(session, {
      content: buffer,
      path: `${UPLOAD_DIRECTORY}/${storedName}`
    });

    return NextResponse.json({
      ok: true,
      upload: {
        characterCount: extracted.characterCount,
        content: extracted.content,
        extension: extension.slice(1),
        id: savedFile.id,
        includedCharacterCount: extracted.content.length,
        name: originalName,
        path: savedFile.path,
        size: savedFile.fileSize,
        truncated: extracted.truncated,
        warnings: extracted.warnings
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? `剧本读取失败：${error.message}` : "剧本读取失败。",
        ok: false
      },
      { status: 422 }
    );
  }
}

export async function DELETE(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const filePath = new URL(request.url).searchParams.get("path")?.trim() ?? "";

  if (!filePath || !scriptUploadPathIsAllowed(filePath)) {
    return NextResponse.json(
      { message: "只能移除当前账号上传的剧本文件。", ok: false },
      { status: 400 }
    );
  }

  try {
    await deleteSkillWorkspacePath(session, filePath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "剧本文件移除失败。",
        ok: false
      },
      { status: 400 }
    );
  }
}
