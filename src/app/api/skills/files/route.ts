import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import {
  createSkillWorkspaceFolder,
  deleteSkillWorkspacePath,
  getSkillChatWorkspace,
  listSkillWorkspaceEntries,
  readSkillWorkspaceFile,
  saveSkillWorkspaceBinaryFile,
  saveSkillWorkspaceFile
} from "@/lib/skill-chat";

type SaveFileBody = {
  content?: string;
  operation?: "mkdir" | "save";
  path?: string;
};

export async function GET(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const url = new URL(request.url);
  const filePath = url.searchParams.get("path")?.trim();
  const dir = url.searchParams.get("dir")?.trim() || "";
  const query = url.searchParams.get("q")?.trim() || "";

  try {
    if (filePath) {
      const file = await readSkillWorkspaceFile(session, filePath);

      return NextResponse.json({
        file,
        ok: true,
        workspace: getSkillChatWorkspace(session)
      });
    }

    const entries = await listSkillWorkspaceEntries(session, { dir, query });

    return NextResponse.json({
      currentDir: dir,
      entries,
      ok: true,
      workspace: getSkillChatWorkspace(session)
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "工作区文件读取失败。",
        ok: false
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "缺少要上传的文件。", ok: false }, { status: 400 });
    }

    const dir = typeof form.get("dir") === "string" ? String(form.get("dir")).trim() : "";
    const customPath = typeof form.get("path") === "string" ? String(form.get("path")).trim() : "";
    const targetPath = customPath || [dir, file.name].filter(Boolean).join("/");
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const savedFile = await saveSkillWorkspaceBinaryFile(session, {
        content: buffer,
        path: targetPath
      });

      return NextResponse.json({
        file: savedFile,
        ok: true,
        workspace: getSkillChatWorkspace(session)
      });
    } catch (error) {
      return NextResponse.json(
        {
          message: error instanceof Error ? error.message : "工作区文件上传失败。",
          ok: false
        },
        { status: 400 }
      );
    }
  }

  const body = (await request.json().catch(() => null)) as SaveFileBody | null;

  if (!body?.path?.trim()) {
    return NextResponse.json({ message: "缺少文件路径。", ok: false }, { status: 400 });
  }

  try {
    if (body.operation === "mkdir") {
      const entry = await createSkillWorkspaceFolder(session, body.path);

      return NextResponse.json({
        entry,
        ok: true,
        workspace: getSkillChatWorkspace(session)
      });
    }

    const file = await saveSkillWorkspaceFile(session, {
      content: body.content ?? "",
      path: body.path
    });

    return NextResponse.json({
      file,
      ok: true,
      workspace: getSkillChatWorkspace(session)
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "工作区文件保存失败。",
        ok: false
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const url = new URL(request.url);
  const filePath = url.searchParams.get("path")?.trim();

  if (!filePath) {
    return NextResponse.json({ message: "缺少要删除的路径。", ok: false }, { status: 400 });
  }

  try {
    const entry = await deleteSkillWorkspacePath(session, filePath);

    return NextResponse.json({
      entry,
      ok: true,
      workspace: getSkillChatWorkspace(session)
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "工作区文件删除失败。",
        ok: false
      },
      { status: 400 }
    );
  }
}
