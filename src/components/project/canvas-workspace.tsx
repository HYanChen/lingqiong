"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type ReactFlowInstance
} from "@xyflow/react";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Boxes,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Copy,
  FileText,
  Film,
  FolderOpen,
  HelpCircle,
  ImageIcon,
  Keyboard,
  Layers3,
  Library,
  MousePointer2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  WandSparkles,
  type LucideIcon
} from "lucide-react";

import { readCanvasProject, type CanvasProject } from "@/components/project/project-creator";
import { cn } from "@/lib/utils";

const fallbackProject: CanvasProject = {
  name: "未命名 AI 影视项目",
  type: "战纪宇宙",
  source: "尚未填写素材来源。",
  goal: "先建立项目骨架，再补充资产、分镜和提示词。",
  style: "电影感、真实质感、可持续更新。",
  deliverables: ["影视大纲", "角色资产库", "分镜", "全能提示词"],
  createdAt: new Date().toISOString()
};

type NodeStatus = "待生成" | "生成中" | "可编辑" | "待审片";
type NodeIcon =
  | "AudioLines"
  | "Boxes"
  | "Clapperboard"
  | "FileText"
  | "Film"
  | "ImageIcon"
  | "Layers3"
  | "Library"
  | "WandSparkles";

type CanvasNodeData = {
  accent: string;
  description: string;
  error?: string;
  icon: NodeIcon;
  lastRunAt?: string;
  model: string;
  prompt: string;
  ratio: string;
  result?: string;
  status: NodeStatus;
  strength: number;
  title: string;
  type: string;
};

type CanvasTemplate = CanvasNodeData & {
  shortcut: string;
};

type CanvasFlowNode = Node<CanvasNodeData, "filmNode">;
type CanvasFlowEdge = Edge;

const canvasStateKey = "wcu_canvas_state_v2";

const iconMap: Record<NodeIcon, LucideIcon> = {
  AudioLines,
  Boxes,
  Clapperboard,
  FileText,
  Film,
  ImageIcon,
  Layers3,
  Library,
  WandSparkles
};

const templates: CanvasTemplate[] = [
  {
    accent: "#67e8f9",
    description: "大纲、人物关系、分集钩子和剧情结构。",
    icon: "FileText",
    model: "WarScript 1.0",
    prompt: "请根据项目素材生成一版 24 集竖屏短剧大纲，突出火种传承、人物选择和每集钩子。",
    ratio: "9:16",
    shortcut: "故事脚本",
    status: "待生成",
    strength: 72,
    title: "故事脚本生成",
    type: "文本生成"
  },
  {
    accent: "#a7f3d0",
    description: "角色三视图、服装关键词和稳定外貌描述。",
    icon: "ImageIcon",
    model: "Character Board",
    prompt: "生成主角、祖辈、反派和关键配角的三视图参考，保持电影感、真实质感、克制热血。",
    ratio: "3:2",
    shortcut: "角色三视图",
    status: "待生成",
    strength: 66,
    title: "角色三视图",
    type: "角色资产"
  },
  {
    accent: "#fde68a",
    description: "关键场面首帧、构图、光影和视频起帧。",
    icon: "Film",
    model: "Frame To Video",
    prompt: "以旧军功章、战地日记和现代青年为视觉核心，生成可用于视频起帧的电影级首帧。",
    ratio: "16:9",
    shortcut: "首帧生视频",
    status: "待生成",
    strength: 78,
    title: "首帧图生视频",
    type: "视频生成"
  },
  {
    accent: "#c4b5fd",
    description: "旁白、环境声、角色台词和声音草案。",
    icon: "AudioLines",
    model: "Audio Sketch",
    prompt: "生成一版低沉、克制、纪录片质感的旁白方案，配合历史记忆和现实选择两条线。",
    ratio: "Audio",
    shortcut: "音频生视频",
    status: "待生成",
    strength: 58,
    title: "音频生视频",
    type: "声音视频"
  },
  {
    accent: "#fca5a5",
    description: "人物、场景、道具、服装、声音和参考图。",
    icon: "Library",
    model: "Asset Hub",
    prompt: "整理当前项目的角色、场景、道具、服装、声音参考和视觉风格，生成可复用资产索引。",
    ratio: "Library",
    shortcut: "资产管理",
    status: "待生成",
    strength: 61,
    title: "资产管理",
    type: "资产库"
  },
  {
    accent: "#93c5fd",
    description: "景别、机位、运镜、表演和视频提示词。",
    icon: "Clapperboard",
    model: "Shot Planner",
    prompt: "把第一集拆成 12 个镜头，标注景别、运镜、人物动作、情绪和视频提示词。",
    ratio: "9:16",
    shortcut: "分镜拆解",
    status: "待生成",
    strength: 70,
    title: "分镜拆解",
    type: "分镜"
  },
  {
    accent: "#f0abfc",
    description: "镜头组、段落组、批量提示词和交付包。",
    icon: "Layers3",
    model: "Batch Board",
    prompt: "把已完成节点整理成镜头组和交付包，输出批量生成所需的提示词、参考图和修订记录。",
    ratio: "Batch",
    shortcut: "批量交付",
    status: "待生成",
    strength: 64,
    title: "批量交付包",
    type: "交付"
  }
];

function createNode(
  template: CanvasTemplate,
  position: { x: number; y: number },
  id = `node-${Date.now()}-${Math.round(Math.random() * 1000)}`
): CanvasFlowNode {
  const data: CanvasNodeData = {
    accent: template.accent,
    description: template.description,
    icon: template.icon,
    lastRunAt: template.lastRunAt,
    model: template.model,
    prompt: template.prompt,
    ratio: template.ratio,
    result: template.result,
    status: template.status,
    strength: template.strength,
    title: template.title,
    type: template.type
  };

  return {
    data,
    id,
    position,
    type: "filmNode"
  };
}

const initialNodes: CanvasFlowNode[] = [
  createNode({ ...templates[0], status: "可编辑" }, { x: 80, y: 150 }, "node-script"),
  createNode(templates[1], { x: 430, y: 90 }, "node-character"),
  createNode({ ...templates[5], status: "可编辑" }, { x: 300, y: 385 }, "node-shot"),
  createNode({ ...templates[2], status: "待审片" }, { x: 710, y: 300 }, "node-video")
];

const initialEdges: CanvasFlowEdge[] = [
  {
    animated: true,
    id: "edge-script-character",
    source: "node-script",
    style: { stroke: "#67e8f9", strokeWidth: 1.6 },
    target: "node-character",
    type: "smoothstep"
  },
  {
    animated: true,
    id: "edge-script-shot",
    source: "node-script",
    style: { stroke: "#67e8f9", strokeWidth: 1.6 },
    target: "node-shot",
    type: "smoothstep"
  },
  {
    id: "edge-character-video",
    source: "node-character",
    style: { stroke: "#a7f3d0", strokeWidth: 1.5 },
    target: "node-video",
    type: "smoothstep"
  },
  {
    id: "edge-shot-video",
    source: "node-shot",
    style: { stroke: "#93c5fd", strokeWidth: 1.5 },
    target: "node-video",
    type: "smoothstep"
  }
];

const canvasViews = ["创意画布", "分镜画布", "资产画布"];
const nodeTypes = { filmNode: FilmCanvasNode };

function FilmCanvasNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const Icon = iconMap[data.icon];

  return (
    <div
      className={cn(
        "w-[240px] rounded-lg border bg-zinc-950/90 p-4 text-left shadow-2xl backdrop-blur transition",
        selected
          ? "border-cyan-200/80 ring-2 ring-cyan-200/20"
          : "border-white/12 hover:border-white/30"
      )}
    >
      <Handle
        className="!h-3 !w-3 !border-2 !border-zinc-950 !bg-cyan-200"
        position={Position.Left}
        type="target"
      />
      <div className="flex items-start justify-between gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.06]"
          style={{ color: data.accent }}
        >
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <span
          className={cn(
            "rounded-lg border px-2 py-1 text-[11px]",
            data.status === "生成中"
              ? "border-amber-200/25 bg-amber-200/10 text-amber-100"
              : data.status === "待审片"
                ? "border-emerald-200/25 bg-emerald-200/10 text-emerald-100"
                : "border-white/10 bg-white/[0.04] text-stone-400"
          )}
        >
          {data.status}
        </span>
      </div>
      <h2 className="mt-4 truncate text-base font-semibold text-stone-50">
        {data.title}
      </h2>
      <p className="mt-2 line-clamp-2 text-xs leading-6 text-stone-400">
        {data.description}
      </p>
      <div className="mt-4 flex items-center justify-between text-[11px] text-stone-500">
        <span>{data.model}</span>
        <span>{data.ratio}</span>
      </div>
      <Handle
        className="!h-3 !w-3 !border-2 !border-zinc-950 !bg-cyan-200"
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

function readSavedCanvasState(projectId: string) {
  const raw = window.localStorage.getItem(`${canvasStateKey}:${projectId}`);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as {
      activeView: string;
      edges: CanvasFlowEdge[];
      nodes: CanvasFlowNode[];
      projectName: string;
    };
  } catch {
    return null;
  }
}

function CanvasWorkspaceInner() {
  const [project, setProject] = useState<CanvasProject>(fallbackProject);
  const [projectName, setProjectName] = useState(fallbackProject.name);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasFlowEdge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState(initialNodes[0].id);
  const [activeTemplate, setActiveTemplate] = useState(templates[0]);
  const [activeView, setActiveView] = useState(canvasViews[0]);
  const [activePanel, setActivePanel] = useState<"工具箱" | "素材库" | "历史记录">("工具箱");
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<CanvasFlowNode, CanvasFlowEdge> | null>(null);
  const [saved, setSaved] = useState(false);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? nodes[0],
    [nodes, selectedNodeId]
  );

  const projectStorageId = project.id ?? "draft";

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const projectId = new URLSearchParams(window.location.search).get("project");
      const localProject = readCanvasProject();
      let nextProject = localProject ?? fallbackProject;

      if (projectId) {
        try {
          const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
          const result = (await response.json().catch(() => null)) as null | {
            ok: boolean;
            project?: CanvasProject;
          };

          if (response.ok && result?.project) {
            nextProject = result.project;
          }
        } catch {
          // Keep local project data available if the database read is unavailable.
        }
      }

      setProject(nextProject);
      setProjectName(nextProject.name);

      const savedState = readSavedCanvasState(nextProject.id ?? "draft");
      if (savedState?.nodes?.length) {
        setNodes(savedState.nodes);
        setEdges(savedState.edges ?? []);
        setActiveView(savedState.activeView ?? canvasViews[0]);
        setProjectName(savedState.projectName ?? nextProject.name);
        setSelectedNodeId(savedState.nodes[0].id);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [setEdges, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "#67e8f9", strokeWidth: 1.6 },
            type: "smoothstep"
          },
          currentEdges
        )
      ),
    [setEdges]
  );

  const onNodeClick: NodeMouseHandler<CanvasFlowNode> = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  function addNodeAt(template: CanvasTemplate, position: { x: number; y: number }) {
    const nextNode = createNode(template, position);
    setNodes((currentNodes) => [...currentNodes, nextNode]);
    setSelectedNodeId(nextNode.id);
    setActivePanel("工具箱");
  }

  function addNodeFromTemplate(template: CanvasTemplate) {
    setActiveTemplate(template);
    addNodeAt(template, {
      x: 160 + nodes.length * 28,
      y: 120 + nodes.length * 22
    });
  }

  function updateSelectedNode(patch: Partial<CanvasNodeData>) {
    if (!selectedNode) {
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, ...patch } }
          : node
      )
    );
  }

  function duplicateSelectedNode() {
    if (!selectedNode) {
      return;
    }

    const duplicate: CanvasFlowNode = {
      ...selectedNode,
      data: {
        ...selectedNode.data,
        title: `${selectedNode.data.title} 副本`
      },
      id: `node-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      position: {
        x: selectedNode.position.x + 42,
        y: selectedNode.position.y + 42
      },
      selected: false
    };

    setNodes((currentNodes) => [...currentNodes, duplicate]);
    setSelectedNodeId(duplicate.id);
  }

  function deleteSelectedNode() {
    if (!selectedNode) {
      return;
    }

    const nextNodes = nodes.filter((node) => node.id !== selectedNode.id);
    setNodes(nextNodes);
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
      )
    );
    setSelectedNodeId(nextNodes[0]?.id ?? "");
  }

  async function runGenerate() {
    if (!selectedNode) {
      return;
    }

    updateSelectedNode({ error: undefined, status: "生成中" });

    try {
      const response = await fetch("/api/models/generate", {
        body: JSON.stringify({
          node: {
            model: selectedNode.data.model,
            prompt: selectedNode.data.prompt,
            ratio: selectedNode.data.ratio,
            strength: selectedNode.data.strength,
            title: selectedNode.data.title,
            type: selectedNode.data.type
          },
          project: {
            goal: project.goal,
            name: projectName,
            source: project.source,
            style: project.style,
            type: project.type
          }
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as null | {
        message?: string;
        ok: boolean;
        text?: string;
      };

      if (!response.ok || !result?.ok || !result.text) {
        updateSelectedNode({
          error: result?.message ?? "模型生成失败，请检查后台 API 配置。",
          status: "可编辑"
        });
        return;
      }

      updateSelectedNode({
        lastRunAt: new Date().toISOString(),
        result: result.text,
        status: "待审片"
      });
    } catch {
      updateSelectedNode({
        error: "模型接口请求失败，请稍后重试。",
        status: "可编辑"
      });
    }
  }

  function saveCanvas() {
    window.localStorage.setItem(
      `${canvasStateKey}:${projectStorageId}`,
      JSON.stringify({
        activeView,
        edges,
        nodes,
        projectName,
        updatedAt: new Date().toISOString()
      })
    );
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  const dockActions: Array<{
    action: () => void;
    icon: LucideIcon;
    label: string;
  }> = [
    { action: () => addNodeFromTemplate(activeTemplate), icon: Plus, label: "添加节点" },
    { action: () => setActivePanel("工具箱"), icon: Settings2, label: "工具箱" },
    { action: () => setActivePanel("素材库"), icon: FolderOpen, label: "素材库" },
    { action: () => setActivePanel("历史记录"), icon: Clock3, label: "历史记录" },
    { action: () => reactFlowInstance?.fitView({ duration: 320, padding: 0.24 }), icon: Keyboard, label: "适配视图" },
    { action: () => setActivePanel("工具箱"), icon: HelpCircle, label: "教程" }
  ];

  return (
    <section
      className="min-h-screen bg-[#060607] px-3 pb-6 pt-24 text-stone-100 md:px-5"
      data-testid="canvas-workspace"
    >
      <div className="mx-auto flex max-w-[1560px] flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-zinc-950/80 p-3 shadow-2xl shadow-black/25 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-stone-300 transition hover:bg-white/10 hover:text-white"
              href="/workflow"
              title="返回生产线"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </Link>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
              <Sparkles aria-hidden="true" className="h-4 w-4 text-cyan-100" />
              <input
                aria-label="项目名称"
                className="min-w-0 max-w-[260px] bg-transparent text-sm font-semibold text-stone-50 outline-none"
                onChange={(event) => setProjectName(event.target.value)}
                value={projectName}
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] p-1">
              {canvasViews.map((view) => (
                <button
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs transition",
                    activeView === view
                      ? "bg-stone-50 text-zinc-950"
                      : "text-stone-400 hover:bg-white/10 hover:text-white"
                  )}
                  key={view}
                  onClick={() => setActiveView(view)}
                  type="button"
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {saved ? (
              <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 text-xs text-emerald-100">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                已保存
              </span>
            ) : null}
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-stone-200 transition hover:bg-white/10"
              onClick={() => reactFlowInstance?.zoomOut({ duration: 180 })}
              type="button"
            >
              缩小
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-stone-200 transition hover:bg-white/10"
              onClick={() => reactFlowInstance?.zoomIn({ duration: 180 })}
              type="button"
            >
              放大
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-stone-200 transition hover:bg-white/10"
              data-testid="canvas-save"
              onClick={saveCanvas}
              type="button"
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              保存画布
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-stone-50 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
              data-testid="canvas-generate"
              onClick={runGenerate}
              type="button"
            >
              生成当前节点
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_340px]">
          <aside className="rounded-lg border border-white/10 bg-zinc-950/72 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-stone-50">画布选项</p>
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-stone-300 transition hover:bg-white/10"
                data-testid="canvas-add-sidebar"
                onClick={() => addNodeFromTemplate(activeTemplate)}
                title="添加节点"
                type="button"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {templates.map((template) => {
                const Icon = iconMap[template.icon];
                const active = activeTemplate.title === template.title;

                return (
                  <button
                    className={cn(
                      "group flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:border-cyan-200/45 hover:bg-white/[0.07]",
                      active
                        ? "border-cyan-200/50 bg-cyan-200/10"
                        : "border-white/10 bg-white/[0.035]"
                    )}
                    key={template.title}
                    onClick={() => setActiveTemplate(template)}
                    onDoubleClick={() => addNodeFromTemplate(template)}
                    type="button"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]"
                      style={{ color: template.accent }}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-stone-100">
                        {template.shortcut}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-stone-500">
                        {template.type}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold text-stone-300">项目信息</p>
              <div className="mt-3 grid gap-3 text-xs leading-6 text-stone-400">
                <p>
                  <span className="text-stone-500">类型：</span>
                  {project.type}
                </p>
                <p>
                  <span className="text-stone-500">目标：</span>
                  {project.goal}
                </p>
              </div>
            </div>
          </aside>

          <div
            className="relative h-[760px] overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_50%_42%,rgba(8,145,178,0.18),transparent_22rem),linear-gradient(135deg,#0b0b0c,#151515)]"
            data-testid="flow-canvas"
            onDoubleClick={(event) => {
              if ((event.target as HTMLElement).closest(".react-flow__node")) {
                return;
              }

              const position = reactFlowInstance?.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY
              }) ?? { x: 260, y: 220 };
              addNodeAt(activeTemplate, position);
            }}
          >
            <ReactFlow
              colorMode="dark"
              connectionLineStyle={{ stroke: "#67e8f9", strokeWidth: 1.6 }}
              defaultEdgeOptions={{
                style: { stroke: "#67e8f9", strokeWidth: 1.6 },
                type: "smoothstep"
              }}
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.26 }}
              nodeTypes={nodeTypes}
              nodes={nodes}
              nodesDraggable
              nodesFocusable
              onConnect={onConnect}
              onEdgesChange={onEdgesChange}
              onInit={setReactFlowInstance}
              onNodeClick={onNodeClick}
              onNodesChange={onNodesChange}
              onPaneClick={() => setSelectedNodeId("")}
              panOnDrag
              proOptions={{ hideAttribution: true }}
              zoomOnDoubleClick={false}
            >
              <Background
                color="rgba(255,255,255,0.16)"
                gap={28}
                size={1}
                variant={BackgroundVariant.Dots}
              />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                maskColor="rgba(0,0,0,0.45)"
                nodeColor={(node) => (node.data as CanvasNodeData).accent}
                nodeStrokeWidth={3}
                pannable
                position="top-right"
                zoomable
              />
            </ReactFlow>

            <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-black/38 px-3 text-xs text-stone-300 backdrop-blur">
                <MousePointer2 aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                {activeView}
              </span>
              <span className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-black/38 px-3 text-xs text-stone-400 backdrop-blur">
                {nodes.length} 节点 / {edges.length} 连线
              </span>
            </div>

            <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/86 p-2 shadow-2xl backdrop-blur-xl">
              {dockActions.map(({ action, icon: Icon, label }) => (
                <button
                  className="grid h-9 w-9 place-items-center rounded-lg text-stone-300 transition hover:bg-white/10 hover:text-white"
                  data-testid={`canvas-dock-${label}`}
                  key={label}
                  onClick={action}
                  title={label}
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-white/10 bg-zinc-950/72 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-stone-50">节点编辑</p>
                <p className="mt-1 text-xs text-stone-500">{activePanel}</p>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-stone-300 transition hover:bg-white/10"
                onClick={() => setActivePanel("工具箱")}
                title="设置"
                type="button"
              >
                <Settings2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 rounded-lg border border-white/10 bg-white/[0.035] p-1">
              {(["工具箱", "素材库", "历史记录"] as const).map((panel) => (
                <button
                  className={cn(
                    "h-8 rounded-lg text-xs transition",
                    activePanel === panel
                      ? "bg-stone-50 text-zinc-950"
                      : "text-stone-400 hover:text-white"
                  )}
                  key={panel}
                  onClick={() => setActivePanel(panel)}
                  type="button"
                >
                  {panel}
                </button>
              ))}
            </div>

            {activePanel === "工具箱" && selectedNode ? (
              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-stone-400">节点名称</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70"
                    onChange={(event) => updateSelectedNode({ title: event.target.value })}
                    value={selectedNode.data.title}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-stone-400">生成提示词</span>
                  <textarea
                    className="mt-2 min-h-32 w-full resize-y rounded-lg border border-white/10 bg-black/24 px-3 py-3 text-sm leading-6 text-stone-100 outline-none transition focus:border-cyan-200/70"
                    onChange={(event) => updateSelectedNode({ prompt: event.target.value })}
                    value={selectedNode.data.prompt}
                  />
                </label>

                {selectedNode.data.error ? (
                  <div className="rounded-lg border border-red-300/20 bg-red-300/10 p-4 text-sm leading-6 text-red-100">
                    {selectedNode.data.error}
                  </div>
                ) : null}

                {selectedNode.data.result ? (
                  <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-emerald-100">模型生成结果</p>
                      {selectedNode.data.lastRunAt ? (
                        <span className="text-xs text-emerald-100/60">
                          {new Date(selectedNode.data.lastRunAt).toLocaleTimeString()}
                        </span>
                      ) : null}
                    </div>
                    <pre className="max-h-56 whitespace-pre-wrap break-words text-xs leading-6 text-emerald-50/90">
                      {selectedNode.data.result}
                    </pre>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-stone-400">模型</span>
                    <select
                      className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-stone-100 outline-none"
                      onChange={(event) => updateSelectedNode({ model: event.target.value })}
                      value={selectedNode.data.model}
                    >
                      {["WarScript 1.0", "Character Board", "Frame To Video", "Audio Sketch", "Asset Hub", "Shot Planner", "Batch Board"].map(
                        (item) => (
                          <option key={item}>{item}</option>
                        )
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-stone-400">画幅</span>
                    <select
                      className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-stone-100 outline-none"
                      onChange={(event) => updateSelectedNode({ ratio: event.target.value })}
                      value={selectedNode.data.ratio}
                    >
                      {["9:16", "16:9", "1:1", "3:2", "Audio", "Library", "Batch"].map(
                        (item) => (
                          <option key={item}>{item}</option>
                        )
                      )}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="flex items-center justify-between text-xs font-medium text-stone-400">
                    创意强度
                    <span>{selectedNode.data.strength}</span>
                  </span>
                  <input
                    className="mt-3 w-full accent-cyan-200"
                    max="100"
                    min="0"
                    onChange={(event) =>
                      updateSelectedNode({ strength: Number(event.target.value) })
                    }
                    type="range"
                    value={selectedNode.data.strength}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 text-sm text-stone-200 transition hover:bg-white/10"
                    data-testid="canvas-copy-node"
                    onClick={duplicateSelectedNode}
                    type="button"
                  >
                    <Copy aria-hidden="true" className="h-4 w-4" />
                    复制
                  </button>
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-300/20 text-sm text-red-100 transition hover:bg-red-300/10"
                    data-testid="canvas-delete-node"
                    onClick={deleteSelectedNode}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    删除
                  </button>
                  <button
                    className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-stone-50 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                    data-testid="canvas-generate-node"
                    onClick={runGenerate}
                    type="button"
                  >
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    生成
                  </button>
                </div>
              </div>
            ) : null}

            {activePanel === "素材库" ? (
              <div className="mt-5 grid gap-3">
                {[
                  ["角色", "主角、祖辈、配角、反派"],
                  ["场景", "家中、展馆、训练场、旧战地"],
                  ["道具", "军功章、日记、旧照片、背包"],
                  ["声音", "旁白、环境声、主题音乐"]
                ].map(([title, body]) => (
                  <button
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-4 text-left transition hover:border-cyan-200/35"
                    key={title}
                    type="button"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-stone-100">
                        {title}
                      </span>
                      <span className="mt-1 block text-xs text-stone-500">{body}</span>
                    </span>
                    <Search aria-hidden="true" className="h-4 w-4 text-stone-500" />
                  </button>
                ))}
              </div>
            ) : null}

            {activePanel === "历史记录" ? (
              <div className="mt-5 grid gap-3">
                {[
                  "创建故事脚本生成节点",
                  "调整角色三视图提示词",
                  "首帧图生视频进入待审片",
                  "保存画布版本"
                ].map((item, index) => (
                  <div
                    className="rounded-lg border border-white/10 bg-black/20 p-4"
                    key={item}
                  >
                    <p className="text-sm text-stone-200">{item}</p>
                    <p className="mt-2 text-xs text-stone-500">{index + 1} 分钟前</p>
                  </div>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}

export function CanvasWorkspace() {
  return (
    <ReactFlowProvider>
      <CanvasWorkspaceInner />
    </ReactFlowProvider>
  );
}
