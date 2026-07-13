<template>
  <div class="lingqiong-page-shell">
    <section class="lingqiong-page-hero operations-hero">
      <div>
        <small>LINGQIONG OPERATIONS</small>
        <h1>运营总览</h1>
        <p>官网用户、创作项目、生产任务与模型调用共享同一业务数据源，前后台修改实时同步。</p>
      </div>
      <a-space class="hero-actions">
        <a-button href="https://pla.wiki/" target="_blank">查看官网</a-button>
        <a-button type="primary" href="https://pla.wiki/projects" target="_blank">进入创作端</a-button>
      </a-space>
    </section>
    <a-row :gutter="16">
      <a-col v-for="item in summaryCards" :key="item.key" :xs="12" :md="6" :xl="3">
        <a-card class="summary-card" :bordered="false">
          <span class="summary-index">{{ String(summaryCards.findIndex((card) => card.key === item.key) + 1).padStart(2, '0') }}</span>
          <a-statistic :title="item.label" :value="summary[item.key] || 0" />
        </a-card>
      </a-col>
    </a-row>

    <a-card class="mt-4" :bordered="false">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="projects" tab="项目管理">
          <BasicTable @register="registerProjectTable">
            <template #action="{ record }">
              <TableAction :actions="projectActions(record)" />
            </template>
          </BasicTable>
        </a-tab-pane>
        <a-tab-pane key="users" tab="用户管理">
          <BasicTable @register="registerUserTable">
            <template #action="{ record }">
              <TableAction :actions="[{ label: '编辑', auth: 'lingqiong:users:edit', onClick: () => openUser(record) }]" />
            </template>
          </BasicTable>
        </a-tab-pane>
        <a-tab-pane key="jobs" tab="生产任务">
          <BasicTable @register="registerJobTable">
            <template #action="{ record }">
              <TableAction :actions="jobActions(record)" />
            </template>
          </BasicTable>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <a-modal v-model:open="projectVisible" title="编辑项目" @ok="saveProject">
      <a-form layout="vertical">
        <a-form-item label="项目名称"><a-input v-model:value="projectDraft.name" /></a-form-item>
        <a-form-item label="项目类型"><a-input v-model:value="projectDraft.type" /></a-form-item>
        <a-form-item label="画面比例"><a-input v-model:value="projectDraft.aspectRatio" /></a-form-item>
        <a-form-item label="创作目标"><a-textarea v-model:value="projectDraft.goal" :rows="3" /></a-form-item>
        <a-form-item label="视觉风格"><a-textarea v-model:value="projectDraft.style" :rows="3" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="userVisible" title="编辑前台用户" @ok="saveUser">
      <a-form layout="vertical">
        <a-form-item label="显示名称"><a-input v-model:value="userDraft.account" /></a-form-item>
        <a-form-item label="联系方式"><a-input v-model:value="userDraft.contact" /></a-form-item>
        <a-form-item label="用户简介"><a-textarea v-model:value="userDraft.profile" :rows="3" /></a-form-item>
        <a-form-item label="账号状态">
          <a-switch v-model:checked="userActive" checked-children="启用" un-checked-children="停用" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-drawer v-model:open="flowVisible" title="项目生产链" width="720">
      <a-spin :spinning="flowLoading">
        <template v-if="flowProject.id">
          <section class="flow-project-card">
            <div>
              <small>PROJECT FLOW</small>
              <h2>{{ flowProject.name }}</h2>
              <p>{{ flowProject.owner_account || '未绑定创作者' }} · {{ flowProject.type }} · {{ flowProject.aspect_ratio }}</p>
            </div>
            <a-button :href="`/projects/${flowProject.id}`" target="_blank">前台查看</a-button>
          </section>

          <a-alert
            class="mb-4"
            type="info"
            show-icon
            message="以下环节读取官网同一个业务数据库；在后台保存后，前台项目工作台刷新即可看到。"
          />

          <div class="flow-grid">
            <button v-for="(step, index) in flowSteps" :key="step.module" class="flow-step" type="button" @click="openFlowModule(step.module)">
              <span class="flow-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ step.label }}</strong>
              <span>{{ flowCounts[step.module] || 0 }} 条</span>
            </button>
          </div>
        </template>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script lang="ts" name="lingqiong-operations" setup>
  import { computed, onMounted, reactive, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { cancelJob, getJobs, getProjectFlow, getProjects, getSummary, getUsers, retryJob, updateProject, updateUser } from './operations.api';

  const { createMessage } = useMessage();
  const router = useRouter();
  const activeTab = ref('projects');
  const summary = reactive<Record<string, number>>({});
  const projectVisible = ref(false);
  const userVisible = ref(false);
  const projectDraft = reactive<any>({});
  const userDraft = reactive<any>({});
  const flowVisible = ref(false);
  const flowLoading = ref(false);
  const flowProject = reactive<any>({});
  const flowCounts = reactive<Record<string, number>>({});
  const userActive = computed({
    get: () => userDraft.active === 1,
    set: (value: boolean) => (userDraft.active = value ? 1 : 0),
  });
  const summaryCards = [
    { key: 'users', label: '前台用户' }, { key: 'projects', label: '创作项目' },
    { key: 'episodes', label: '剧集' }, { key: 'assets', label: '角色与资产' },
    { key: 'storyboards', label: '分镜' }, { key: 'queuedJobs', label: '排队任务' },
    { key: 'failedJobs', label: '失败任务' }, { key: 'modelCalls', label: '模型调用' },
  ];
  const flowSteps = [
    { module: 'episodes', label: '剧集与剧本' },
    { module: 'elements', label: '角色与资产' },
    { module: 'storyboards', label: '分镜' },
    { module: 'voiceovers', label: '配音' },
    { module: 'compositions', label: '合成' },
    { module: 'uploads', label: '项目素材' },
    { module: 'generationJobs', label: '生成任务' },
  ];

  const projectColumns = [
    { title: '项目名称', dataIndex: 'name', width: 220 },
    { title: '所有者', dataIndex: 'ownerAccount', width: 150 },
    { title: '类型', dataIndex: 'type', width: 130 },
    { title: '比例', dataIndex: 'aspectRatio', width: 90 },
    { title: '更新时间', dataIndex: 'updatedAt', width: 190 },
  ];
  const userColumns = [
    { title: '显示名称', dataIndex: 'account', width: 180 },
    { title: '登录账号', dataIndex: 'username', width: 170 },
    { title: '联系方式', dataIndex: 'contact', width: 200 },
    { title: '来源', dataIndex: 'source', width: 100 },
    { title: '状态', dataIndex: 'active', width: 90, customRender: ({ text }) => (text === 1 ? '启用' : '停用') },
    { title: '最后登录', dataIndex: 'lastLoginAt', width: 190 },
  ];
  const jobColumns = [
    { title: '任务类型', dataIndex: 'taskType', width: 150 },
    { title: '项目ID', dataIndex: 'projectId', width: 220 },
    { title: '创建人', dataIndex: 'createdByAccount', width: 140 },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '尝试次数', dataIndex: 'attemptCount', width: 100 },
    { title: '错误', dataIndex: 'error', width: 260 },
    { title: '创建时间', dataIndex: 'createdAt', width: 190 },
  ];

  const { tableContext: projectContext } = useListPage({ tableProps: { title: '创作项目', api: getProjects, columns: projectColumns, actionColumn: { width: 90 } } });
  const { tableContext: userContext } = useListPage({ tableProps: { title: '前台用户', api: getUsers, columns: userColumns, actionColumn: { width: 90 } } });
  const { tableContext: jobContext } = useListPage({ tableProps: { title: '生成任务', api: getJobs, columns: jobColumns, actionColumn: { width: 150 } } });
  const [registerProjectTable, { reload: reloadProjects }] = projectContext;
  const [registerUserTable, { reload: reloadUsers }] = userContext;
  const [registerJobTable, { reload: reloadJobs }] = jobContext;

  function openProject(record) { Object.assign(projectDraft, record); projectVisible.value = true; }
  function openUser(record) { Object.assign(userDraft, record); userVisible.value = true; }
  async function openProjectFlow(record) {
    flowVisible.value = true;
    flowLoading.value = true;
    Object.keys(flowProject).forEach((key) => delete flowProject[key]);
    Object.keys(flowCounts).forEach((key) => delete flowCounts[key]);
    try {
      const result: any = await getProjectFlow(record.id);
      Object.assign(flowProject, result.project || {});
      Object.assign(flowCounts, result.counts || {});
    } finally {
      flowLoading.value = false;
    }
  }
  function openFlowModule(module: string) {
    flowVisible.value = false;
    router.push({ path: '/lingqiong/data', query: { module, projectId: flowProject.id } });
  }
  function projectActions(record) {
    return [
      { label: '生产链', auth: 'lingqiong:projects:list', onClick: () => openProjectFlow(record) },
      { label: '编辑', auth: 'lingqiong:projects:edit', onClick: () => openProject(record) },
    ];
  }
  async function saveProject() { await updateProject(projectDraft); projectVisible.value = false; createMessage.success('项目已更新，前台已同步'); reloadProjects(); loadSummary(); }
  async function saveUser() { await updateUser(userDraft); userVisible.value = false; createMessage.success('用户已更新，前台账号已同步'); reloadUsers(); loadSummary(); }
  function jobActions(record) {
    return [
      { label: '重试', auth: 'lingqiong:jobs:operate', ifShow: record.status === 'failed' || record.status === 'cancelled', onClick: async () => { await retryJob(record.id); createMessage.success('已重新排队'); reloadJobs(); } },
      { label: '取消', auth: 'lingqiong:jobs:operate', ifShow: record.status === 'queued' || record.status === 'running', popConfirm: { title: '确认取消该任务？', confirm: async () => { await cancelJob(record.id); createMessage.success('任务已取消'); reloadJobs(); } } },
    ];
  }
  async function loadSummary() { Object.assign(summary, await getSummary()); }
  onMounted(loadSummary);
</script>

<style scoped>
  .operations-hero { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .summary-card { position: relative; min-height: 112px; margin-bottom: 16px; overflow: hidden; }
  .summary-card::after { content: ''; position: absolute; right: -26px; bottom: -38px; width: 90px; height: 90px; border: 1px solid rgba(103, 232, 249, 0.12); border-radius: 50%; }
  .summary-index { display: block; margin-bottom: 8px; color: #334155; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; }
  .flow-project-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 18px; padding: 20px; border: 1px solid rgba(103, 232, 249, 0.16); border-radius: 16px; background: linear-gradient(135deg, rgba(8, 47, 73, 0.78), rgba(15, 23, 42, 0.76)); }
  .flow-project-card small { color: #67e8f9; font-weight: 700; letter-spacing: 0.2em; }
  .flow-project-card h2 { margin: 6px 0 4px; color: #f8fafc; font-size: 22px; }
  .flow-project-card p { margin: 0; color: #94a3b8; }
  .flow-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .flow-step { display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 10px; padding: 16px; color: #e2e8f0; text-align: left; border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 14px; background: rgba(15, 23, 42, 0.65); transition: border-color 0.2s ease, transform 0.2s ease; }
  .flow-step:hover { border-color: rgba(103, 232, 249, 0.45); transform: translateY(-1px); }
  .flow-step > span:last-child { color: #67e8f9; }
  .flow-index { color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; }
  @media (max-width: 768px) { .operations-hero { align-items: flex-start; flex-direction: column; } }
  @media (max-width: 640px) { .flow-grid { grid-template-columns: 1fr; } .flow-project-card { align-items: flex-start; flex-direction: column; } }
</style>
