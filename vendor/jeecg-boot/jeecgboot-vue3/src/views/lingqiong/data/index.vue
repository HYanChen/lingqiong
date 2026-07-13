<template>
  <div class="lingqiong-page-shell">
    <section class="lingqiong-page-hero data-hero">
      <div>
        <small>UNIFIED BUSINESS DATA</small>
        <h1>全业务数据中心</h1>
        <p>官网、创作者工作台与运营后台共用同一套业务数据；按项目连续管理剧本、资产、分镜、配音、合成与任务。</p>
      </div>
      <a-space>
        <a-button href="/projects" target="_blank">打开前台项目</a-button>
        <a-button type="primary" @click="selectModule('projects')">项目总表</a-button>
      </a-space>
    </section>

    <a-card class="flow-card" :bordered="false">
      <div class="flow-title">
        <div>
          <strong>项目生产主流程</strong>
          <span>从项目开始，后续环节自动沿用当前项目筛选。</span>
        </div>
        <a-tag v-if="projectId" color="cyan">当前项目：{{ projectId }}</a-tag>
      </div>
      <div class="flow-strip">
        <button
          v-for="(step, index) in flowSteps"
          :key="step.key"
          :class="['flow-node', { active: currentModule === step.key }]"
          type="button"
          @click="selectModule(step.key)"
        >
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <strong>{{ step.label }}</strong>
        </button>
      </div>
    </a-card>

    <div class="data-layout">
      <a-card class="module-panel" :bordered="false">
        <div v-for="group in groupedModules" :key="group.name" class="module-group">
          <p>{{ group.name }}</p>
          <button
            v-for="item in group.items"
            :key="item.key"
            :class="['module-button', { active: item.key === currentModule }]"
            type="button"
            @click="selectModule(item.key)"
          >
            <span>{{ item.label }}</span>
            <small>{{ item.editable ? '可维护' : '只读' }}</small>
          </button>
        </div>
      </a-card>

      <a-card class="records-panel" :bordered="false">
        <div class="records-head">
          <div>
            <small>{{ activeModule?.group || '业务数据' }}</small>
            <h2>{{ activeModule?.label || '数据列表' }}</h2>
            <p>{{ moduleDescription }}</p>
          </div>
          <a-space wrap>
            <a-input-search
              v-model:value="keyword"
              allow-clear
              placeholder="搜索当前模块"
              style="width: 240px"
              @search="searchRecords"
            />
            <a-button v-if="projectScoped && projectId" @click="clearProjectFilter">查看全部项目</a-button>
            <a-button @click="loadRecords">刷新</a-button>
            <a-button v-if="activeModule?.allowCreate" type="primary" @click="openCreate">新增记录</a-button>
          </a-space>
        </div>

        <a-alert
          v-if="projectScoped && !projectId"
          class="mb-4"
          type="warning"
          show-icon
          message="当前显示全部项目数据。建议先从“创作项目”选择一个项目进入生产链，避免误改其他项目。"
        />
        <a-alert
          v-else-if="projectScoped && projectId"
          class="mb-4"
          type="success"
          show-icon
          :message="`已锁定项目 ${projectId}，新增记录会自动带入该项目。`"
        />

        <a-table
          :columns="tableColumns"
          :data-source="records"
          :loading="loading"
          :pagination="pagination"
          row-key="id"
          :scroll="{ x: 980 }"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === '__actions'">
              <a-space>
                <a-button v-if="currentModule === 'projects'" type="link" size="small" @click="openProjectFlow(record)">生产链</a-button>
                <a-button type="link" size="small" @click="openDetail(record)">查看</a-button>
                <a-button v-if="activeModule?.editable" type="link" size="small" @click="openEdit(record)">编辑</a-button>
                <a-popconfirm v-if="activeModule?.allowDelete" title="确认删除这条业务数据？" @confirm="removeRecord(record.id)">
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
            <template v-else>
              <span :title="formatValue(record[column.dataIndex])" class="cell-value">{{ formatValue(record[column.dataIndex]) }}</span>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <a-drawer v-model:open="editorVisible" :title="editingId ? `编辑${activeModule?.label || '记录'}` : `新增${activeModule?.label || '记录'}`" width="680">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col v-for="column in editableColumns" :key="column.name" :xs="24" :md="isLongField(column) ? 24 : 12">
            <a-form-item :label="fieldLabel(column.name)" :required="!column.nullable">
              <a-switch v-if="isBooleanField(column)" v-model:checked="draft[column.name]" checked-children="是" un-checked-children="否" />
              <a-input-number v-else-if="isNumberField(column)" v-model:value="draft[column.name]" style="width: 100%" />
              <a-textarea v-else-if="isLongField(column)" v-model:value="draft[column.name]" :rows="4" />
              <a-input v-else v-model:value="draft[column.name]" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <template #extra><a-button type="primary" :loading="saving" @click="submitRecord">保存并同步前台</a-button></template>
    </a-drawer>

    <a-drawer v-model:open="detailVisible" :title="`${activeModule?.label || '记录'}详情`" width="720">
      <a-descriptions bordered :column="1" size="small">
        <a-descriptions-item v-for="column in columns" :key="column.name" :label="fieldLabel(column.name)">
          <pre class="detail-value">{{ formatDetail(detailRecord[column.name]) }}</pre>
        </a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </div>
</template>

<script lang="ts" name="lingqiong-data-center" setup>
  import { computed, onMounted, reactive, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { deleteDataRecord, getDataModules, getDataRecords, saveDataRecord } from './data.api';

  type DataModule = { key: string; label: string; group: string; editable: boolean; allowCreate: boolean; allowDelete: boolean };
  type DataColumn = { name: string; type: string; nullable: boolean; primary: boolean; editable: boolean };

  const route = useRoute();
  const router = useRouter();
  const { createMessage } = useMessage();
  const modules = ref<DataModule[]>([]);
  const currentModule = ref('projects');
  const projectId = ref('');
  const keyword = ref('');
  const records = ref<any[]>([]);
  const columns = ref<DataColumn[]>([]);
  const total = ref(0);
  const pageNo = ref(1);
  const pageSize = ref(20);
  const loading = ref(false);
  const saving = ref(false);
  const editorVisible = ref(false);
  const detailVisible = ref(false);
  const editingId = ref('');
  const draft = reactive<any>({});
  const detailRecord = reactive<any>({});
  const projectScopedModules = new Set(['episodes', 'elements', 'storyboards', 'voiceovers', 'compositions', 'uploads', 'generationJobs']);
  const flowSteps = [
    { key: 'projects', label: '项目' }, { key: 'episodes', label: '剧集' }, { key: 'elements', label: '资产' },
    { key: 'storyboards', label: '分镜' }, { key: 'voiceovers', label: '配音' }, { key: 'compositions', label: '合成' },
    { key: 'generationJobs', label: '任务' },
  ];
  const descriptions: Record<string, string> = {
    projects: '官网创作者创建的项目会实时出现在这里；从“生产链”进入后续环节。',
    episodes: '管理项目剧集、剧本内容和制作状态。', elements: '管理角色、场景、道具及声音资产。',
    storyboards: '管理镜头、提示词、对白、机位与生成结果。', voiceovers: '管理台词、说话人、音色与配音文件。',
    compositions: '管理时间线、合成参数与成片输出。', generationJobs: '查看前台发起的生成任务和执行状态。',
    frontUsers: '前台注册、微信登录或第三方登录创建的创作者账号。', billingAudits: '模型调用与灵穹 API 余额扣费审计。',
  };

  const activeModule = computed(() => modules.value.find((item) => item.key === currentModule.value));
  const projectScoped = computed(() => projectScopedModules.has(currentModule.value));
  const moduleDescription = computed(() => descriptions[currentModule.value] || '直接读取灵穹业务数据库，所有修改对官网和创作者工作台生效。');
  const groupedModules = computed(() => {
    const groups = new Map<string, DataModule[]>();
    modules.value.forEach((item) => groups.set(item.group, [...(groups.get(item.group) || []), item]));
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  });
  const importantFields = ['name', 'title', 'account', 'username', 'owner_account', 'type', 'status', 'project_id', 'updated_at', 'created_at'];
  const tableColumns = computed(() => {
    const ordered = [...columns.value].sort((a, b) => {
      const ai = importantFields.indexOf(a.name); const bi = importantFields.indexOf(b.name);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
    const visible = ordered.filter((column) => !isLongField(column)).slice(0, 7);
    return [
      ...visible.map((column) => ({ title: fieldLabel(column.name), dataIndex: column.name, key: column.name, width: column.name === 'name' || column.name === 'title' ? 220 : 150 })),
      { title: '操作', key: '__actions', fixed: 'right', width: currentModule.value === 'projects' ? 220 : 160 },
    ];
  });
  const editableColumns = computed(() => columns.value.filter((column) => column.editable));
  const pagination = computed(() => ({ current: pageNo.value, pageSize: pageSize.value, total: total.value, showSizeChanger: true, showTotal: (value: number) => `共 ${value} 条` }));

  const labels: Record<string, string> = {
    id: 'ID', project_id: '项目 ID', episode_id: '剧集 ID', storyboard_id: '分镜 ID', owner_id: '所有者 ID', owner_account: '所有者',
    name: '名称', title: '标题', type: '类型', aspect_ratio: '画面比例', source: '素材来源', goal: '创作目标', style: '视觉风格',
    status: '状态', script: '剧本', summary: '摘要', description: '说明', prompt: '提示词', negative_prompt: '负面提示词', dialogue: '对白', camera: '镜头',
    line_text: '台词', speaker_name: '说话人', audio_url: '音频地址', output_url: '输出地址', created_at: '创建时间', updated_at: '更新时间',
    account: '显示名称', username: '登录账号', contact: '联系方式', active: '启用', sort_order: '排序', category: '分类', label: '显示名称',
  };

  function fieldLabel(name: string) { return labels[name] || name.replaceAll('_', ' '); }
  function isBooleanField(column: DataColumn) { return /tinyint\(1\)|boolean/i.test(column.type); }
  function isNumberField(column: DataColumn) { return /^(int|bigint|smallint|decimal|double|float)/i.test(column.type) && !isBooleanField(column); }
  function isLongField(column: DataColumn) { return /text|json|blob/i.test(column.type) || /(_json|script|prompt|description|summary|profile|notes|error)$/.test(column.name); }
  function formatValue(value: any) {
    if (value === null || value === undefined || value === '') return '—';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return text.length > 42 ? `${text.slice(0, 42)}…` : text;
  }
  function formatDetail(value: any) { return value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value); }
  function clearObject(target: any) { Object.keys(target).forEach((key) => delete target[key]); }

  async function loadModules() {
    modules.value = (await getDataModules()) || [];
    if (!modules.value.some((item) => item.key === currentModule.value)) currentModule.value = modules.value[0]?.key || 'projects';
  }
  async function loadRecords() {
    if (!currentModule.value) return;
    loading.value = true;
    try {
      const result: any = await getDataRecords(currentModule.value, {
        pageNo: pageNo.value, pageSize: pageSize.value, keyword: keyword.value || undefined,
        projectId: projectScoped.value && projectId.value ? projectId.value : undefined,
      });
      records.value = result.records || [];
      columns.value = result.columns || [];
      total.value = Number(result.total || 0);
    } finally { loading.value = false; }
  }
  async function selectModule(module: string) {
    const nextProjectId = projectScopedModules.has(module) ? projectId.value : '';
    await router.replace({ path: '/lingqiong/data', query: { module, ...(nextProjectId ? { projectId: nextProjectId } : {}) } });
  }
  async function clearProjectFilter() { await router.replace({ path: '/lingqiong/data', query: { module: currentModule.value } }); }
  async function openProjectFlow(record: any) { await router.replace({ path: '/lingqiong/data', query: { module: 'episodes', projectId: record.id } }); }
  function searchRecords() { pageNo.value = 1; loadRecords(); }
  function handleTableChange(next: any) { pageNo.value = next.current || 1; pageSize.value = next.pageSize || 20; loadRecords(); }
  function openCreate() {
    clearObject(draft); editingId.value = '';
    editableColumns.value.forEach((column) => { draft[column.name] = isBooleanField(column) ? false : undefined; });
    if (projectScoped.value && projectId.value && editableColumns.value.some((column) => column.name === 'project_id')) draft.project_id = projectId.value;
    editorVisible.value = true;
  }
  function openEdit(record: any) {
    clearObject(draft); editingId.value = record.id;
    Object.assign(draft, JSON.parse(JSON.stringify(record)));
    editableColumns.value.filter(isBooleanField).forEach((column) => { draft[column.name] = Boolean(Number(draft[column.name])); });
    editorVisible.value = true;
  }
  function openDetail(record: any) { clearObject(detailRecord); Object.assign(detailRecord, record); detailVisible.value = true; }
  async function submitRecord() {
    saving.value = true;
    try {
      const payload = { ...draft, ...(editingId.value ? { id: editingId.value } : {}) };
      editableColumns.value.filter(isBooleanField).forEach((column) => { payload[column.name] = payload[column.name] ? 1 : 0; });
      await saveDataRecord(currentModule.value, payload);
      editorVisible.value = false; createMessage.success('保存成功，官网与前台已同步'); await loadRecords();
    } finally { saving.value = false; }
  }
  async function removeRecord(id: string) { await deleteDataRecord(currentModule.value, id); createMessage.success('记录已删除'); await loadRecords(); }

  watch(() => [route.query.module, route.query.projectId], async ([module, scopedProject]) => {
    currentModule.value = typeof module === 'string' && module ? module : 'projects';
    projectId.value = typeof scopedProject === 'string' ? scopedProject : '';
    pageNo.value = 1; keyword.value = ''; await loadRecords();
  });
  onMounted(async () => {
    currentModule.value = typeof route.query.module === 'string' ? route.query.module : 'projects';
    projectId.value = typeof route.query.projectId === 'string' ? route.query.projectId : '';
    await loadModules(); await loadRecords();
  });
</script>

<style scoped>
  .data-hero { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .flow-card { margin: 16px 0; }
  .flow-title { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
  .flow-title div { display: flex; flex-direction: column; gap: 4px; }
  .flow-title strong { color: #f8fafc; font-size: 17px; }
  .flow-title span { color: #94a3b8; font-size: 13px; }
  .flow-strip { display: grid; grid-template-columns: repeat(7, minmax(92px, 1fr)); gap: 8px; overflow-x: auto; }
  .flow-node { min-width: 92px; padding: 13px 10px; color: #94a3b8; text-align: left; border: 1px solid rgba(148, 163, 184, 0.14); border-radius: 12px; background: rgba(15, 23, 42, 0.55); }
  .flow-node span { display: block; margin-bottom: 4px; color: #475569; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; }
  .flow-node strong { color: #cbd5e1; }
  .flow-node.active { border-color: rgba(103, 232, 249, 0.5); background: rgba(8, 145, 178, 0.14); }
  .flow-node.active span, .flow-node.active strong { color: #67e8f9; }
  .data-layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 16px; align-items: start; }
  .module-panel { position: sticky; top: 82px; max-height: calc(100vh - 110px); overflow: auto; }
  .module-group + .module-group { margin-top: 18px; }
  .module-group > p { margin: 0 0 7px; color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; }
  .module-button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; padding: 9px 10px; color: #cbd5e1; text-align: left; border: 1px solid transparent; border-radius: 9px; background: transparent; }
  .module-button small { color: #475569; }
  .module-button:hover, .module-button.active { border-color: rgba(103, 232, 249, 0.2); background: rgba(34, 211, 238, 0.08); }
  .module-button.active span, .module-button.active small { color: #67e8f9; }
  .records-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
  .records-head small { color: #67e8f9; font-weight: 700; letter-spacing: 0.14em; }
  .records-head h2 { margin: 5px 0 2px; color: #f8fafc; font-size: 22px; }
  .records-head p { margin: 0; color: #94a3b8; }
  .cell-value { display: block; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .detail-value { max-width: 100%; margin: 0; color: inherit; font-family: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
  @media (max-width: 1100px) { .data-layout { grid-template-columns: 1fr; } .module-panel { position: static; max-height: none; } .module-panel :deep(.ant-card-body) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; } }
  @media (max-width: 768px) { .data-hero, .records-head, .flow-title { align-items: flex-start; flex-direction: column; } .module-panel :deep(.ant-card-body) { grid-template-columns: 1fr; } }
</style>
