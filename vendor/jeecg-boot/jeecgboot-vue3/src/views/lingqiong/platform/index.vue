<template>
  <div class="p-4">
    <a-card :bordered="false">
      <template #title>
        <div>
          <div class="page-title">官网与平台配置</div>
          <div class="page-subtitle">在统一后台维护官网人物、登录渠道、模型接口和项目分类。</div>
        </div>
      </template>

      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="site" tab="官网基础内容">
          <a-alert class="mb-4" type="info" show-icon message="这里维护官网品牌介绍、公司主体、联系方式和全站视觉素材，保存后公开页面立即读取新内容。" />
          <a-form v-if="siteContent.brand && siteContent.company && siteContent.media" layout="vertical" class="settings-form">
            <a-divider orientation="left">品牌信息</a-divider>
            <a-row :gutter="16">
              <a-col :xs="24" :md="12"><a-form-item label="品牌中文名"><a-input v-model:value="siteContent.brand.name" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="品牌英文名"><a-input v-model:value="siteContent.brand.english" /></a-form-item></a-col>
              <a-col :span="24"><a-form-item label="品牌标语"><a-input v-model:value="siteContent.brand.tagline" /></a-form-item></a-col>
              <a-col :span="24"><a-form-item label="品牌介绍"><a-textarea v-model:value="siteContent.brand.description" :rows="4" /></a-form-item></a-col>
            </a-row>
            <a-divider orientation="left">公司与联系方式</a-divider>
            <a-row :gutter="16">
              <a-col :xs="24" :md="12"><a-form-item label="公司简称"><a-input v-model:value="siteContent.company.name" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="公司全称"><a-input v-model:value="siteContent.company.legalName" /></a-form-item></a-col>
              <a-col :span="24"><a-form-item label="主体定位"><a-input v-model:value="siteContent.company.role" /></a-form-item></a-col>
              <a-col :xs="24" :md="8"><a-form-item label="联系邮箱"><a-input v-model:value="siteContent.company.contact.email" /></a-form-item></a-col>
              <a-col :xs="24" :md="8"><a-form-item label="联系电话"><a-input v-model:value="siteContent.company.contact.phone" /></a-form-item></a-col>
              <a-col :xs="24" :md="8"><a-form-item label="联系微信"><a-input v-model:value="siteContent.company.contact.wechat" /></a-form-item></a-col>
            </a-row>
            <a-divider orientation="left">官网媒体素材</a-divider>
            <a-row :gutter="16">
              <a-col v-for="item in mediaFields" :key="item.key" :xs="24" :md="12"><a-form-item :label="item.label"><a-input v-model:value="siteContent.media[item.key]" /></a-form-item></a-col>
            </a-row>
            <a-button type="primary" :loading="savingSite" @click="saveSiteBasics">保存官网基础内容</a-button>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="team" tab="团队与顾问">
          <div class="section-toolbar">
            <a-alert type="info" show-icon message="人物分组支持直接输入新分类；照片支持本地上传，保存后官网人物卡片与详情页同步生效。" />
            <a-button type="primary" @click="openTeam()">新增人物</a-button>
          </div>
          <a-row :gutter="16">
            <a-col v-for="(member, index) in teamMembers" :key="member.slug || index" :xs="24" :md="12" :xl="8">
              <a-card class="person-card" size="small">
                <div class="person-head">
                  <a-avatar :size="72" :src="member.avatar">{{ member.name?.slice(0, 1) }}</a-avatar>
                  <div class="person-copy">
                    <strong>{{ member.name || '未命名人物' }}</strong>
                    <span>{{ member.role || '未设置岗位' }}</span>
                    <a-tag color="cyan">{{ member.group || '未分组' }}</a-tag>
                  </div>
                </div>
                <p class="person-bio">{{ member.bio || '暂未填写人物简介。' }}</p>
                <a-space>
                  <a-button size="small" @click="openTeam(member, index)">编辑</a-button>
                  <a-button size="small" @click="moveTeam(index, -1)" :disabled="index === 0">上移</a-button>
                  <a-button size="small" @click="moveTeam(index, 1)" :disabled="index === teamMembers.length - 1">下移</a-button>
                  <a-popconfirm title="确认删除该人物？" @confirm="removeTeam(index)">
                    <a-button size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </a-card>
            </a-col>
          </a-row>
        </a-tab-pane>

        <a-tab-pane key="wechat" tab="微信与统一登录">
          <a-alert class="mb-4" type="warning" show-icon message="AppSecret 只会加密保存在业务库中，页面不会回显；留空保存代表继续使用已有密钥。" />
          <a-form layout="vertical" class="settings-form">
            <a-row :gutter="16">
              <a-col :xs="24" :md="12">
                <a-form-item label="启用微信登录"><a-switch v-model:checked="wechat.enabled" /></a-form-item>
              </a-col>
              <a-col :xs="24" :md="12">
                <a-form-item label="登录模式">
                  <a-radio-group v-model:value="wechat.mode">
                    <a-radio-button value="official">微信开放平台</a-radio-button>
                    <a-radio-button value="local-scan">本机测试扫码</a-radio-button>
                  </a-radio-group>
                </a-form-item>
              </a-col>
              <a-col :xs="24" :md="12"><a-form-item label="AppID"><a-input v-model:value="wechat.appId" /></a-form-item></a-col>
              <a-col :xs="24" :md="12">
                <a-form-item label="AppSecret">
                  <a-input-password v-model:value="wechat.appSecret" :placeholder="wechat.appSecretConfigured ? '已配置，留空不修改' : '请输入 AppSecret'" />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :md="12"><a-form-item label="扫码标题"><a-input v-model:value="wechat.qrTitle" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="默认用户名称"><a-input v-model:value="wechat.defaultAccount" /></a-form-item></a-col>
              <a-col :span="24"><a-form-item label="扫码提示"><a-textarea v-model:value="wechat.qrHint" :rows="3" /></a-form-item></a-col>
            </a-row>
            <a-button type="primary" :loading="savingWechat" @click="submitWechat">保存微信登录配置</a-button>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="models" tab="模型接口">
          <div class="section-toolbar">
            <a-alert type="info" show-icon message="用户在灵穹 API 账户充值后，前台模型能力才可调用；此处维护平台可用的模型通道。" />
            <a-button type="primary" @click="openModel()">新增模型接口</a-button>
          </div>
          <a-table :columns="modelColumns" :data-source="modelConfigs" row-key="id" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'enabled'"><a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用' : '停用' }}</a-tag></template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="openModel(record)">编辑</a-button>
                  <a-popconfirm title="确认删除该模型接口？" @confirm="removeModel(record.id)"><a-button danger type="link" size="small">删除</a-button></a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="types" tab="项目类型">
          <div class="section-toolbar">
            <a-alert type="info" show-icon message="项目类型会直接出现在前台新建项目流程中，可随时新增、排序或停用。" />
            <a-button type="primary" @click="openType()">新增项目类型</a-button>
          </div>
          <a-table :columns="typeColumns" :data-source="projectTypes" row-key="id" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'active'"><a-tag :color="record.active ? 'green' : 'default'">{{ record.active ? '启用' : '停用' }}</a-tag></template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="openType(record)">编辑</a-button>
                  <a-popconfirm title="确认删除该项目类型？" @confirm="removeType(record.id)"><a-button danger type="link" size="small">删除</a-button></a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <a-modal v-model:open="teamVisible" :title="teamIndex < 0 ? '新增人物' : '编辑人物'" width="760px" @ok="saveTeam">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="12"><a-form-item label="姓名" required><a-input v-model:value="teamDraft.name" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item label="岗位" required><a-input v-model:value="teamDraft.role" /></a-form-item></a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="分组分类" required>
              <a-auto-complete v-model:value="teamDraft.group" :options="groupOptions" placeholder="选择或直接输入新分类" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12"><a-form-item label="详情页标识" required><a-input v-model:value="teamDraft.slug" placeholder="例如 zhang-san" /></a-form-item></a-col>
          <a-col :span="24">
            <a-form-item label="人物照片">
              <div class="upload-row">
                <a-avatar :size="80" :src="teamDraft.avatar">{{ teamDraft.name?.slice(0, 1) }}</a-avatar>
                <a-upload :show-upload-list="false" accept="image/jpeg,image/png,image/webp,image/gif" :custom-request="uploadAvatar">
                  <a-button :loading="uploading">上传图片</a-button>
                </a-upload>
                <a-input v-model:value="teamDraft.avatar" placeholder="也可填写 /media/xxx.jpg 或外部图片地址" />
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="24"><a-form-item label="人物详细简介"><a-textarea v-model:value="teamDraft.bio" :rows="4" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item label="专业方向（每行一项）"><a-textarea v-model:value="teamExpertise" :rows="5" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item label="履历亮点（每行一项）"><a-textarea v-model:value="teamHighlights" :rows="5" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal v-model:open="modelVisible" :title="modelDraft.id ? '编辑模型接口' : '新增模型接口'" width="720px" @ok="submitModel">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="12"><a-form-item label="配置名称" required><a-input v-model:value="modelDraft.name" /></a-form-item></a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="提供方"><a-select v-model:value="modelDraft.provider"><a-select-option value="new-api">灵穹 API</a-select-option><a-select-option value="openai-compatible">OpenAI 兼容接口</a-select-option><a-select-option value="mock">本地测试</a-select-option></a-select></a-form-item>
          </a-col>
          <a-col :span="24"><a-form-item label="Base URL"><a-input v-model:value="modelDraft.baseUrl" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item label="模型名称"><a-input v-model:value="modelDraft.model" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item label="API Key"><a-input-password v-model:value="modelDraft.apiKey" placeholder="已配置时留空不修改" /></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="温度"><a-input-number v-model:value="modelDraft.temperature" :min="0" :max="2" :step="0.1" style="width:100%" /></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="最大 Token"><a-input-number v-model:value="modelDraft.maxTokens" :min="1" style="width:100%" /></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="启用"><a-switch v-model:checked="modelDraft.enabled" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="系统提示词"><a-textarea v-model:value="modelDraft.systemPrompt" :rows="4" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal v-model:open="typeVisible" :title="typeDraft.id ? '编辑项目类型' : '新增项目类型'" @ok="submitType">
      <a-form layout="vertical">
        <a-form-item label="类型名称" required><a-input v-model:value="typeDraft.label" /></a-form-item>
        <a-form-item label="分类"><a-input v-model:value="typeDraft.category" placeholder="例如 短剧漫剧、宣传片" /></a-form-item>
        <a-form-item label="说明"><a-textarea v-model:value="typeDraft.description" :rows="3" /></a-form-item>
        <a-row :gutter="16"><a-col :span="12"><a-form-item label="排序"><a-input-number v-model:value="typeDraft.sortOrder" style="width:100%" /></a-form-item></a-col><a-col :span="12"><a-form-item label="启用"><a-switch v-model:checked="typeDraft.active" /></a-form-item></a-col></a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script lang="ts" name="lingqiong-platform-settings" setup>
  import { computed, onMounted, reactive, ref } from 'vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import {
    deleteModelApi, deleteProjectType, getLoginSettings, getModelApis, getProjectTypes, getSiteContent,
    saveLoginSettings, saveModelApi, saveProjectType, saveSiteContent, uploadSiteImage,
  } from './platform.api';

  const { createMessage } = useMessage();
  const activeTab = ref('team');
  const siteContent = ref<any>({ teamMembers: [] });
  const teamMembers = computed(() => siteContent.value.teamMembers || []);
  const teamVisible = ref(false);
  const teamIndex = ref(-1);
  const teamDraft = reactive<any>({});
  const teamExpertise = ref('');
  const teamHighlights = ref('');
  const uploading = ref(false);
  const savingSite = ref(false);
  const wechat = reactive<any>({ enabled: false, mode: 'official', appId: '', appSecret: '', qrTitle: '微信扫码登录', qrHint: '', defaultAccount: '微信创作者', defaultContact: 'wechat-user' });
  const savingWechat = ref(false);
  const modelConfigs = ref<any[]>([]);
  const modelVisible = ref(false);
  const modelDraft = reactive<any>({});
  const projectTypes = ref<any[]>([]);
  const typeVisible = ref(false);
  const typeDraft = reactive<any>({});
  const groupOptions = computed(() => [...new Set(teamMembers.value.map((item) => item.group).filter(Boolean))].map((value) => ({ value })));
  const modelColumns = [
    { title: '名称', dataIndex: 'name' }, { title: '通道', dataIndex: 'provider' }, { title: '模型', dataIndex: 'model' },
    { title: 'Base URL', dataIndex: 'baseUrl', ellipsis: true }, { title: '状态', key: 'enabled', width: 90 }, { title: '操作', key: 'actions', width: 140 },
  ];
  const typeColumns = [
    { title: '类型名称', dataIndex: 'label' }, { title: '分类', dataIndex: 'category' }, { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'sortOrder', width: 90 }, { title: '状态', key: 'active', width: 90 }, { title: '操作', key: 'actions', width: 140 },
  ];
  const mediaFields = [
    { key: 'hero', label: '首页主视觉图片' }, { key: 'heroVideo', label: '首页主视觉视频' },
    { key: 'spark', label: '作品视觉图' }, { key: 'workflow', label: '生产线视觉图' },
    { key: 'generations', label: '世界观视觉图' }, { key: 'services', label: '服务视觉图' },
  ];

  function clear(target) { Object.keys(target).forEach((key) => delete target[key]); }
  function lines(value: string) { return value.split('\n').map((item) => item.trim()).filter(Boolean); }
  async function loadTeam() { siteContent.value = await getSiteContent(); }
  async function persistTeam(message = '官网团队内容已更新') { const result = await saveSiteContent(siteContent.value); siteContent.value = result.data || siteContent.value; createMessage.success(message); }
  async function saveSiteBasics() { savingSite.value = true; try { await persistTeam('官网基础内容已保存'); } finally { savingSite.value = false; } }
  function openTeam(member?: any, index = -1) {
    clear(teamDraft); teamIndex.value = index;
    Object.assign(teamDraft, member ? JSON.parse(JSON.stringify(member)) : { name: '', role: '', group: '', slug: '', avatar: '', bio: '', expertise: [], highlights: [] });
    teamExpertise.value = (teamDraft.expertise || []).join('\n'); teamHighlights.value = (teamDraft.highlights || []).join('\n'); teamVisible.value = true;
  }
  async function saveTeam() {
    if (!teamDraft.name?.trim() || !teamDraft.role?.trim() || !teamDraft.group?.trim() || !teamDraft.slug?.trim()) return createMessage.warning('请完整填写姓名、岗位、分组和详情页标识');
    const member = { ...teamDraft, name: teamDraft.name.trim(), role: teamDraft.role.trim(), group: teamDraft.group.trim(), slug: teamDraft.slug.trim(), expertise: lines(teamExpertise.value), highlights: lines(teamHighlights.value) };
    if (teamIndex.value < 0) siteContent.value.teamMembers.push(member); else siteContent.value.teamMembers.splice(teamIndex.value, 1, member);
    await persistTeam(); teamVisible.value = false;
  }
  async function removeTeam(index: number) { siteContent.value.teamMembers.splice(index, 1); await persistTeam('人物已删除'); }
  async function moveTeam(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= teamMembers.value.length) return; const [item] = siteContent.value.teamMembers.splice(index, 1); siteContent.value.teamMembers.splice(target, 0, item); await persistTeam('人物排序已更新'); }
  async function uploadAvatar(options) {
    uploading.value = true;
    try { const result: any = await uploadSiteImage(options.file, options.onProgress); teamDraft.avatar = result?.url || result?.result?.url || ''; if (!teamDraft.avatar) throw new Error('图片地址为空'); options.onSuccess?.(result); createMessage.success('图片上传成功'); }
    catch (error) { options.onError?.(error); createMessage.error('图片上传失败'); }
    finally { uploading.value = false; }
  }
  async function loadWechat() { const result: any = await getLoginSettings(); Object.assign(wechat, result.wechat || {}, { appSecret: '' }); }
  async function submitWechat() { savingWechat.value = true; try { const result: any = await saveLoginSettings({ wechat: { ...wechat } }); Object.assign(wechat, result.settings?.wechat || wechat, { appSecret: '' }); createMessage.success('微信登录配置已保存'); } finally { savingWechat.value = false; } }
  async function loadModels() { const result: any = await getModelApis(); modelConfigs.value = result.configs || []; }
  function openModel(record?: any) { clear(modelDraft); Object.assign(modelDraft, record ? { ...record, apiKey: '' } : { name: '', provider: 'new-api', baseUrl: 'http://new-api:3000/v1', model: '', apiKey: '', temperature: 0.7, maxTokens: 1200, enabled: true, systemPrompt: '' }); modelVisible.value = true; }
  async function submitModel() { if (!modelDraft.name?.trim()) return createMessage.warning('请填写配置名称'); await saveModelApi({ ...modelDraft }); modelVisible.value = false; createMessage.success('模型接口已保存'); await loadModels(); }
  async function removeModel(id: string) { await deleteModelApi(id); createMessage.success('模型接口已删除'); await loadModels(); }
  async function loadTypes() { const result: any = await getProjectTypes(); projectTypes.value = result.types || []; }
  function openType(record?: any) { clear(typeDraft); Object.assign(typeDraft, record ? { ...record } : { label: '', category: '短剧漫剧', description: '', sortOrder: 0, active: true }); typeVisible.value = true; }
  async function submitType() { if (!typeDraft.label?.trim()) return createMessage.warning('请填写类型名称'); await saveProjectType({ ...typeDraft }); typeVisible.value = false; createMessage.success('项目类型已保存'); await loadTypes(); }
  async function removeType(id: string) { await deleteProjectType(id); createMessage.success('项目类型已删除'); await loadTypes(); }
  onMounted(async () => { await Promise.all([loadTeam(), loadWechat(), loadModels(), loadTypes()]); });
</script>

<style scoped>
  .page-title { font-size: 20px; font-weight: 700; }
  .page-subtitle { margin-top: 4px; color: var(--text-color-secondary); font-size: 13px; font-weight: 400; }
  .section-toolbar { display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .section-toolbar :deep(.ant-alert) { flex: 1; }
  .person-card { margin-bottom: 16px; min-height: 230px; }
  .person-head { display: flex; gap: 14px; align-items: center; }
  .person-copy { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .person-copy strong { font-size: 17px; }
  .person-copy span { color: var(--text-color-secondary); }
  .person-bio { height: 66px; margin: 16px 0; color: var(--text-color-secondary); overflow: hidden; }
  .settings-form { max-width: 980px; }
  .upload-row { display: flex; gap: 12px; align-items: center; }
  .upload-row :deep(.ant-input) { flex: 1; }
  @media (max-width: 768px) { .section-toolbar, .upload-row { align-items: stretch; flex-direction: column; } }
</style>
