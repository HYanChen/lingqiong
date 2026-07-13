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
              <TableAction :actions="[{ label: '编辑', auth: 'lingqiong:projects:edit', onClick: () => openProject(record) }]" />
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
  </div>
</template>

<script lang="ts" name="lingqiong-operations" setup>
  import { computed, onMounted, reactive, ref } from 'vue';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { cancelJob, getJobs, getProjects, getSummary, getUsers, retryJob, updateProject, updateUser } from './operations.api';

  const { createMessage } = useMessage();
  const activeTab = ref('projects');
  const summary = reactive<Record<string, number>>({});
  const projectVisible = ref(false);
  const userVisible = ref(false);
  const projectDraft = reactive<any>({});
  const userDraft = reactive<any>({});
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
  async function saveProject() { await updateProject(projectDraft); projectVisible.value = false; createMessage.success('项目已更新'); reloadProjects(); }
  async function saveUser() { await updateUser(userDraft); userVisible.value = false; createMessage.success('用户已更新'); reloadUsers(); }
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
  @media (max-width: 768px) { .operations-hero { align-items: flex-start; flex-direction: column; } }
</style>
