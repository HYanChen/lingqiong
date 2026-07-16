<template>
  <div class="lingqiong-page-shell">
    <section class="lingqiong-page-hero platform-hero">
      <div>
        <small>PLATFORM CONTROL</small>
        <h1>灵穹内容管理工作台</h1>
        <p>按要完成的任务找到对应入口；保存后的品牌、人物、登录和创作配置会立即同步前台。</p>
      </div>
      <a-button href="https://pla.wiki/" target="_blank">预览正式官网</a-button>
    </section>
    <a-card :bordered="false">
      <template #title>
        <div>
          <div class="page-title">内容管理工作台</div>
          <div class="page-subtitle">不知道从哪里修改时，先在管理首页搜索内容或按任务进入。</div>
        </div>
      </template>

      <div v-if="activeTab !== 'overview'" class="section-context">
        <a-button type="link" class="section-context__back" @click="activeTab = 'overview'">← 返回管理首页</a-button>
        <div v-if="currentAdminSection" class="section-context__copy">
          <small>当前正在编辑</small>
          <strong>{{ currentAdminSection.title }}</strong>
          <span>{{ currentAdminSection.description }}</span>
        </div>
      </div>

      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="overview" tab="管理首页">
          <section class="admin-overview">
            <div class="admin-overview__intro">
              <div>
                <small>QUICK NAVIGATION</small>
                <h2>你现在想修改什么？</h2>
                <p>搜索页面名称、业务模块或操作关键词，也可以直接从下方任务卡片进入。原有管理功能均保留。</p>
              </div>
              <a-input-search
                v-model:value="adminSearch"
                class="admin-overview__search"
                allow-clear
                size="large"
                placeholder="搜索：团队、首页文案、微信登录、Skill……"
              />
            </div>

            <div class="admin-overview__guide">
              <span><i></i> 官网展示内容</span>
              <span><i></i> 用户登录与创作能力</span>
              <span><i></i> 保存后同步灵穹前台</span>
            </div>

            <div v-if="filteredAdminSections.length" class="admin-section-grid">
              <article v-for="section in filteredAdminSections" :key="section.key" class="admin-section-card" @click="openAdminSection(section.key)">
                <div class="admin-section-card__top">
                  <span class="admin-section-card__icon">{{ section.icon }}</span>
                  <a-tag :color="section.color">{{ section.category }}</a-tag>
                </div>
                <div class="admin-section-card__body">
                  <h3>{{ section.title }}</h3>
                  <p>{{ section.description }}</p>
                </div>
                <div class="admin-section-card__footer">
                  <span>{{ section.status }}</span>
                  <a-button type="link" class="admin-section-card__action" @click.stop="openAdminSection(section.key)">进入修改 →</a-button>
                </div>
              </article>
            </div>
            <a-empty v-else class="admin-overview__empty" description="没有找到对应模块，请尝试搜索“官网”“团队”或“登录”" />
          </section>
        </a-tab-pane>

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
              <a-col v-for="item in mediaFields" :key="item.key" :xs="24" :md="12">
                <a-form-item :label="item.label">
                  <a-input-group compact>
                    <a-input v-model:value="siteContent.media[item.key]" style="width: calc(100% - 96px)" />
                    <a-upload :show-upload-list="false" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" :custom-request="(options) => uploadMedia(item.key, options)">
                      <a-button :loading="uploadingMediaKey === item.key">上传素材</a-button>
                    </a-upload>
                  </a-input-group>
                </a-form-item>
              </a-col>
            </a-row>
            <a-divider orientation="left">导航与首页信任点</a-divider>
            <a-form-item label="首页信任点（每行一项）"><a-textarea v-model:value="proofPointsText" :rows="4" /></a-form-item>
            <div v-for="(nav, index) in siteContent.navItems" :key="index" class="inline-editor-row">
              <a-input v-model:value="nav.label" placeholder="导航名称" />
              <a-input v-model:value="nav.href" placeholder="链接，如 /works" />
              <a-button danger @click="siteContent.navItems.splice(index, 1)">删除</a-button>
            </div>
            <a-button class="mb-4" @click="siteContent.navItems.push({ label: '', href: '/' })">新增导航</a-button>
            <a-button type="primary" :loading="savingSite" @click="saveSiteBasics">保存官网基础内容</a-button>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="copy" tab="页面文案">
          <div class="section-toolbar">
            <a-alert type="info" show-icon message="官网首页、世界观、作品、服务、关于、生产线及全局页头页脚文案均在此维护，保存后前台立即读取。" />
            <a-button type="primary" :loading="savingSite" @click="saveSiteBasics">保存全部页面文案</a-button>
          </div>
          <a-segmented v-model:value="copyGroup" :options="copyGroups" class="mb-4" />
          <a-form layout="vertical" class="copy-grid">
            <a-form-item v-for="entry in filteredSiteCopy" :key="entry.key" :label="entry.label">
              <a-textarea v-if="entry.multiline" v-model:value="entry.value" :rows="entry.value?.includes('\n') ? 6 : 3" />
              <a-input v-else v-model:value="entry.value" />
              <small class="field-key">{{ entry.key }}</small>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <a-tab-pane v-for="definition in collectionDefinitions" :key="definition.key" :tab="definition.tab">
          <div class="section-toolbar">
            <a-alert type="info" show-icon :message="definition.hint" />
            <a-button type="primary" @click="openCollection(definition.key)">新增{{ definition.itemName }}</a-button>
          </div>
          <a-row :gutter="16">
            <a-col v-for="(item, index) in siteContent[definition.key] || []" :key="item.slug || item.title || index" :xs="24" :md="12" :xl="8">
              <a-card class="content-card" size="small">
                <div class="content-card__head">
                  <div>
                    <strong>{{ item.title || '未命名内容' }}</strong>
                    <span>{{ collectionSubtitle(definition.key, item) }}</span>
                  </div>
                  <a-tag color="cyan">{{ index + 1 }}</a-tag>
                </div>
                <p>{{ item.summary || item.logline || item.output || '暂未填写说明。' }}</p>
                <a-space wrap>
                  <a-button size="small" @click="openCollection(definition.key, item, index)">编辑</a-button>
                  <a-button size="small" :disabled="index === 0" @click="moveCollection(definition.key, index, -1)">上移</a-button>
                  <a-button size="small" :disabled="index === siteContent[definition.key].length - 1" @click="moveCollection(definition.key, index, 1)">下移</a-button>
                  <a-popconfirm title="确认删除该内容？" @confirm="removeCollection(definition.key, index)"><a-button size="small" danger>删除</a-button></a-popconfirm>
                </a-space>
              </a-card>
            </a-col>
          </a-row>
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
                    <a-radio-button value="official">微信公众号网页授权</a-radio-button>
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

        <a-tab-pane key="skills" tab="Skill 管理">
          <div class="section-toolbar">
            <a-alert type="info" show-icon message="这里维护前台 Skill 库的完整数据：基础信息、可见范围和全部任务模块。保存后创作者端会读取同一份数据。" />
            <a-space>
              <a-button href="/skills" target="_blank">查看用户端</a-button>
              <a-button type="primary" @click="openSkill()">新增 Skill</a-button>
            </a-space>
          </div>
          <a-table :columns="skillColumns" :data-source="skills" row-key="id" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'active'"><a-tag :color="record.active ? 'green' : 'default'">{{ record.active ? '启用' : '停用' }}</a-tag></template>
              <template v-if="column.key === 'modules'"><a-tag color="cyan">{{ record.modules?.length || 0 }} 个模块</a-tag></template>
              <template v-if="column.key === 'visibility'"><a-tag :color="record.visibility === 'public' ? 'blue' : 'gold'">{{ record.visibility === 'public' ? '全部用户' : '仅所有者' }}</a-tag></template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="openSkill(record)">编辑</a-button>
                  <a-popconfirm title="确认删除该 Skill？" @confirm="removeSkill(record.id)"><a-button danger type="link" size="small">删除</a-button></a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
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

    <a-modal v-model:open="collectionVisible" :title="collectionIndex < 0 ? `新增${activeCollectionDefinition.itemName}` : `编辑${activeCollectionDefinition.itemName}`" width="820px" @ok="saveCollection">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col v-for="field in activeCollectionDefinition.fields" :key="field.key" :xs="24" :md="field.span || 12">
            <a-form-item :label="field.label" :required="field.required">
              <template v-if="field.kind === 'lines'">
                <a-textarea v-model:value="collectionDraft[field.key]" :rows="4" placeholder="每行一项" />
              </template>
              <template v-else-if="field.kind === 'textarea'">
                <a-textarea v-model:value="collectionDraft[field.key]" :rows="4" />
              </template>
              <template v-else-if="field.kind === 'image'">
                <div class="upload-row">
                  <a-avatar shape="square" :size="80" :src="collectionDraft[field.key]" />
                  <a-upload :show-upload-list="false" accept="image/jpeg,image/png,image/webp,image/gif" :custom-request="(options) => uploadCollectionImage(field.key, options)">
                    <a-button :loading="uploadingCollection">上传图片</a-button>
                  </a-upload>
                  <a-input v-model:value="collectionDraft[field.key]" placeholder="图片地址" />
                </div>
              </template>
              <a-input v-else v-model:value="collectionDraft[field.key]" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal v-model:open="skillVisible" :title="skillDraft.id ? '编辑并发布 Skill' : '新增并发布 Skill'" width="1040px" ok-text="保存并同步前台" @ok="submitSkill">
      <a-form layout="vertical">
        <a-alert class="mb-4" type="info" show-icon message="用户端按“Skill → 任务模块”运行。请至少保留一个模块；模块顺序、输入材料、输出结果和提示词都会原样同步。" />
        <a-row :gutter="16">
          <a-col :xs="24" :md="12"><a-form-item label="名称" required><a-input v-model:value="skillDraft.displayName" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item label="触发词"><a-input v-model:value="skillDraft.triggerName" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item label="分类"><a-input v-model:value="skillDraft.category" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item label="所有者"><a-input v-model:value="skillDraft.owner" placeholder="默认：平台团队" /></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="来源"><a-select v-model:value="skillDraft.source"><a-select-option value="平台">平台</a-select-option><a-select-option value="内置">内置</a-select-option><a-select-option value="用户上传">用户上传</a-select-option></a-select></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="前台可见范围"><a-select v-model:value="skillDraft.visibility"><a-select-option value="public">全部用户可见</a-select-option><a-select-option value="private">仅所有者可见</a-select-option></a-select></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="发布状态"><a-switch v-model:checked="skillDraft.active" checked-children="已发布" un-checked-children="已停用" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="说明"><a-textarea v-model:value="skillDraft.description" :rows="3" /></a-form-item></a-col>
        </a-row>
        <a-divider orientation="left">任务模块</a-divider>
        <div class="module-toolbar">
          <div><strong>用户选择具体模块后才会调用模型</strong><p>建议一个模块只完成一个明确任务，并写清输入材料、输出结果和下一步。</p></div>
          <a-button type="dashed" @click="addSkillModule">新增模块</a-button>
        </div>
        <div v-for="(module, index) in skillModules" :key="module.id" class="skill-module-editor">
          <div class="skill-module-editor__head">
            <div><a-tag color="cyan">{{ module.order || String(index + 1).padStart(2, '0') }}</a-tag><strong>{{ module.title || '未命名模块' }}</strong></div>
            <a-space>
              <a-button size="small" :disabled="index === 0" @click="moveSkillModule(index, -1)">上移</a-button>
              <a-button size="small" :disabled="index === skillModules.length - 1" @click="moveSkillModule(index, 1)">下移</a-button>
              <a-popconfirm title="确认删除这个任务模块？" @confirm="removeSkillModule(index)"><a-button size="small" danger>删除</a-button></a-popconfirm>
            </a-space>
          </div>
          <a-row :gutter="16">
            <a-col :xs="24" :md="8"><a-form-item label="模块名称" required><a-input v-model:value="module.title" placeholder="例如：剧本会诊" /></a-form-item></a-col>
            <a-col :xs="24" :md="8"><a-form-item label="用户端短名称"><a-input v-model:value="module.shortTitle" placeholder="例如：诊断已有剧本" /></a-form-item></a-col>
            <a-col :xs="12" :md="4"><a-form-item label="顺序"><a-input v-model:value="module.order" placeholder="01" /></a-form-item></a-col>
            <a-col :xs="12" :md="4"><a-form-item label="状态"><a-select v-model:value="module.status"><a-select-option value="可继续生产">可继续生产</a-select-option><a-select-option value="待补材料">待补材料</a-select-option><a-select-option value="初稿">初稿</a-select-option></a-select></a-form-item></a-col>
            <a-col :span="24"><a-form-item label="模块说明"><a-textarea v-model:value="module.description" :rows="2" /></a-form-item></a-col>
            <a-col :xs="24" :md="12"><a-form-item label="输入材料（每行一项）"><a-textarea v-model:value="module.materialsText" :rows="4" /></a-form-item></a-col>
            <a-col :xs="24" :md="12"><a-form-item label="输出结果（每行一项）"><a-textarea v-model:value="module.outputsText" :rows="4" /></a-form-item></a-col>
            <a-col :span="24"><a-form-item label="模块系统提示词" required><a-textarea v-model:value="module.prompt" :rows="5" /></a-form-item></a-col>
            <a-col :xs="24" :md="12"><a-form-item label="参考文件"><a-input v-model:value="module.reference" placeholder="例如 references/02-script-doctor.md" /></a-form-item></a-col>
            <a-col :xs="24" :md="12"><a-form-item label="完成后的下一步"><a-input v-model:value="module.nextStep" /></a-form-item></a-col>
          </a-row>
        </div>
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
    deleteModelApi, deleteProjectType, deleteSkill, getLoginSettings, getModelApis, getProjectTypes, getSiteContent, getSkills,
    saveLoginSettings, saveModelApi, saveProjectType, saveSiteContent, saveSkill, uploadSiteImage,
  } from './platform.api';

  const { createMessage } = useMessage();
  const activeTab = ref('overview');
  const adminSearch = ref('');
  const siteContent = ref<any>({ teamMembers: [] });
  const proofPointsText = ref('');
  const uploadingMediaKey = ref('');
  const copyGroup = ref('全局');
  const copyGroups = computed(() => [...new Set((siteContent.value.siteCopy || []).map((item) => item.group).filter(Boolean))]);
  const filteredSiteCopy = computed(() => (siteContent.value.siteCopy || []).filter((item) => item.group === copyGroup.value));
  const teamMembers = computed(() => siteContent.value.teamMembers || []);
  const teamVisible = ref(false);
  const teamIndex = ref(-1);
  const teamDraft = reactive<any>({});
  const teamExpertise = ref('');
  const teamHighlights = ref('');
  const uploading = ref(false);
  const collectionVisible = ref(false);
  const collectionKey = ref('works');
  const collectionIndex = ref(-1);
  const collectionDraft = reactive<any>({});
  const uploadingCollection = ref(false);
  const savingSite = ref(false);
  const wechat = reactive<any>({ enabled: false, mode: 'official', appId: '', appSecret: '', qrTitle: '微信扫码登录', qrHint: '', defaultAccount: '微信创作者', defaultContact: 'wechat-user' });
  const savingWechat = ref(false);
  const skills = ref<any[]>([]);
  const skillVisible = ref(false);
  const skillDraft = reactive<any>({});
  const skillModules = ref<any[]>([]);
  const modelConfigs = ref<any[]>([]);
  const modelVisible = ref(false);
  const modelDraft = reactive<any>({});
  const projectTypes = ref<any[]>([]);
  const typeVisible = ref(false);
  const typeDraft = reactive<any>({});
  const collectionDefinitions = [
    {
      key: 'works', tab: '作品管理', itemName: '作品', hint: '作品卡片、详情页和首页重点作品共用这一份数据。',
      fields: [
        { key: 'title', label: '作品标题', required: true }, { key: 'slug', label: '详情页标识', required: true },
        { key: 'category', label: '分类' }, { key: 'status', label: '状态' }, { key: 'format', label: '内容形态' },
        { key: 'image', label: '封面图片', kind: 'image', span: 24 }, { key: 'logline', label: '作品简介', kind: 'textarea', span: 24 },
        { key: 'tags', label: '标签', kind: 'lines' }, { key: 'deliverables', label: '交付项', kind: 'lines' },
      ],
    },
    {
      key: 'services', tab: '服务管理', itemName: '服务', hint: '服务页卡片和生产线服务节点共用这一份数据。',
      fields: [
        { key: 'title', label: '服务名称', required: true }, { key: 'audience', label: '适用对象' }, { key: 'timeline', label: '交付周期' },
        { key: 'icon', label: '图标标识' }, { key: 'summary', label: '服务说明', kind: 'textarea', span: 24 },
        { key: 'deliverables', label: '交付项', kind: 'lines', span: 24 },
      ],
    },
    {
      key: 'universeChapters', tab: '世界观管理', itemName: '世界观章节', hint: '世界观时间线和首页品牌定位卡片共用这一份数据。',
      fields: [
        { key: 'title', label: '章节标题', required: true }, { key: 'period', label: '时代阶段' }, { key: 'icon', label: '图标标识' },
        { key: 'summary', label: '章节说明', kind: 'textarea', span: 24 },
      ],
    },
    {
      key: 'pipelineSteps', tab: '生产线管理', itemName: '生产步骤', hint: '官网流程、生产线大厅和项目说明共用这一份步骤数据。',
      fields: [
        { key: 'eyebrow', label: '步骤编号/眉题', required: true }, { key: 'title', label: '步骤标题', required: true }, { key: 'icon', label: '图标标识' },
        { key: 'summary', label: '步骤说明', kind: 'textarea', span: 24 }, { key: 'output', label: '阶段产物', kind: 'textarea', span: 24 },
      ],
    },
  ];
  const activeCollectionDefinition = computed(() => collectionDefinitions.find((item) => item.key === collectionKey.value) || collectionDefinitions[0]);
  const groupOptions = computed(() => [...new Set(teamMembers.value.map((item) => item.group).filter(Boolean))].map((value) => ({ value })));
  const modelColumns = [
    { title: '名称', dataIndex: 'name' }, { title: '通道', dataIndex: 'provider' }, { title: '模型', dataIndex: 'model' },
    { title: 'Base URL', dataIndex: 'baseUrl', ellipsis: true }, { title: '状态', key: 'enabled', width: 90 }, { title: '操作', key: 'actions', width: 140 },
  ];
  const typeColumns = [
    { title: '类型名称', dataIndex: 'label' }, { title: '分类', dataIndex: 'category' }, { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'sortOrder', width: 90 }, { title: '状态', key: 'active', width: 90 }, { title: '操作', key: 'actions', width: 140 },
  ];
  const skillColumns = [
    { title: '名称', dataIndex: 'displayName' }, { title: '触发词', dataIndex: 'triggerName' }, { title: '分类', dataIndex: 'category' },
    { title: '模块', key: 'modules', width: 110 }, { title: '可见范围', key: 'visibility', width: 110 },
    { title: '来源', dataIndex: 'source', width: 100 }, { title: '状态', key: 'active', width: 90 }, { title: '操作', key: 'actions', width: 140 },
  ];
  const mediaFields = [
    { key: 'hero', label: '首页主视觉图片' }, { key: 'heroVideo', label: '首页主视觉视频' },
    { key: 'spark', label: '作品视觉图' }, { key: 'workflow', label: '生产线视觉图' },
    { key: 'generations', label: '世界观视觉图' }, { key: 'services', label: '服务视觉图' },
  ];
  const adminSections = computed(() => [
    {
      key: 'site', icon: '品', color: 'cyan', category: '官网内容', title: '品牌与联系方式',
      description: '修改品牌名称、公司主体、联系方式、导航和全站图片视频。',
      status: siteContent.value.brand?.name ? `当前品牌：${siteContent.value.brand.name}` : '正在读取官网配置',
      keywords: '官网 首页 品牌 公司 联系 邮箱 电话 微信 导航 图片 视频 素材 logo 页头 页脚',
    },
    {
      key: 'copy', icon: '文', color: 'blue', category: '官网内容', title: '页面标题与文案',
      description: '修改首页、世界观、作品、服务、关于、生产线及全局页头页脚文案。',
      status: `${siteContent.value.siteCopy?.length || 0} 项可编辑文案`,
      keywords: '文案 标题 副标题 介绍 首页 世界观 作品 服务 关于 生产线 页头 页脚 按钮',
    },
    {
      key: 'works', icon: '作', color: 'geekblue', category: '官网内容', title: '作品与案例',
      description: '新增、编辑、排序作品卡片、封面、详情介绍和交付内容。',
      status: `${siteContent.value.works?.length || 0} 个作品`,
      keywords: '作品 案例 封面 详情 标签 交付 作品集',
    },
    {
      key: 'services', icon: '服', color: 'purple', category: '官网内容', title: '服务与交付',
      description: '维护服务名称、适用对象、周期、说明和对应交付项目。',
      status: `${siteContent.value.services?.length || 0} 项服务`,
      keywords: '服务 交付 周期 适用对象 客户',
    },
    {
      key: 'universeChapters', icon: '界', color: 'volcano', category: '官网内容', title: '世界观章节',
      description: '管理世界观时间线、时代阶段、章节标题和内容说明。',
      status: `${siteContent.value.universeChapters?.length || 0} 个章节`,
      keywords: '世界观 宇宙 时间线 时代 章节',
    },
    {
      key: 'pipelineSteps', icon: '产', color: 'orange', category: '官网内容', title: '生产线流程',
      description: '调整官网与创作项目共用的生产步骤、阶段说明和产物。',
      status: `${siteContent.value.pipelineSteps?.length || 0} 个生产步骤`,
      keywords: '生产线 流程 步骤 阶段 产物 项目说明',
    },
    {
      key: 'team', icon: '人', color: 'green', category: '官网内容', title: '团队与顾问',
      description: '新增、编辑、排序团队成员和顾问，上传照片并维护人物详情。',
      status: `${teamMembers.value.length} 位人物`,
      keywords: '团队 顾问 人物 员工 成员 照片 头像 分组 简介 履历',
    },
    {
      key: 'wechat', icon: '登', color: 'green', category: '登录配置', title: '微信与统一登录',
      description: '配置微信登录开关、授权模式、AppID、密钥和扫码提示。',
      status: wechat.enabled ? '微信登录已启用' : '微信登录未启用',
      keywords: '登录 微信 扫码 appid appsecret 授权 账号 用户',
    },
    {
      key: 'skills', icon: '技', color: 'cyan', category: '创作能力', title: 'Skill 工作台',
      description: '维护用户可见的 Skill、任务模块、输入材料、输出结果和执行提示词。',
      status: `${skills.value.length} 个 Skill`,
      keywords: 'skill 技能 工作台 模块 任务 提示词 输入 输出 用户端 创作',
    },
    {
      key: 'models', icon: '模', color: 'blue', category: '创作能力', title: '模型接口',
      description: '新增或调整模型通道、API 地址、模型名称、计费和启停状态。',
      status: `${modelConfigs.value.filter((item) => item.enabled).length}/${modelConfigs.value.length} 个接口启用`,
      keywords: '模型 api 接口 通道 baseurl 密钥 计费 充值 ai',
    },
    {
      key: 'types', icon: '项', color: 'gold', category: '创作能力', title: '项目类型',
      description: '维护用户新建项目时可选择的类型、分类、说明、排序和状态。',
      status: `${projectTypes.value.filter((item) => item.active).length}/${projectTypes.value.length} 个类型启用`,
      keywords: '项目 类型 分类 新建项目 排序 短剧 漫剧',
    },
  ]);
  const filteredAdminSections = computed(() => {
    const query = adminSearch.value.trim().toLocaleLowerCase();
    if (!query) return adminSections.value;
    return adminSections.value.filter((section) => `${section.title} ${section.category} ${section.description} ${section.keywords}`.toLocaleLowerCase().includes(query));
  });
  const currentAdminSection = computed(() => adminSections.value.find((section) => section.key === activeTab.value));

  function clear(target) { Object.keys(target).forEach((key) => delete target[key]); }
  function lines(value: string) { return value.split('\n').map((item) => item.trim()).filter(Boolean); }
  function openAdminSection(key: string) { activeTab.value = key; }
  async function loadTeam() {
    siteContent.value = await getSiteContent();
    siteContent.value.navItems ||= [];
    siteContent.value.siteCopy ||= [];
    collectionDefinitions.forEach((item) => { siteContent.value[item.key] ||= []; });
    proofPointsText.value = (siteContent.value.proofPoints || []).join('\n');
    if (!copyGroups.value.includes(copyGroup.value)) copyGroup.value = copyGroups.value[0] || '全局';
  }
  async function persistTeam(message = '官网内容已更新') {
    const result = await saveSiteContent(siteContent.value);
    siteContent.value = result.data || siteContent.value;
    proofPointsText.value = (siteContent.value.proofPoints || []).join('\n');
    createMessage.success(message);
  }
  async function saveSiteBasics() {
    savingSite.value = true;
    try { siteContent.value.proofPoints = lines(proofPointsText.value); await persistTeam('官网全部内容已保存并同步前台'); }
    finally { savingSite.value = false; }
  }
  async function uploadMedia(key: string, options) {
    uploadingMediaKey.value = key;
    try {
      const result: any = await uploadSiteImage(options.file, options.onProgress);
      siteContent.value.media[key] = result?.url || result?.result?.url || '';
      if (!siteContent.value.media[key]) throw new Error('素材地址为空');
      options.onSuccess?.(result); createMessage.success('素材上传成功，保存后生效');
    } catch (error) { options.onError?.(error); createMessage.error('素材上传失败'); }
    finally { uploadingMediaKey.value = ''; }
  }
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
  function collectionSubtitle(key: string, item: any) {
    if (key === 'works') return [item.category, item.status, item.format].filter(Boolean).join(' · ');
    if (key === 'services') return [item.audience, item.timeline].filter(Boolean).join(' · ');
    if (key === 'universeChapters') return item.period || '未设置时代';
    return item.eyebrow || '未设置步骤编号';
  }
  function openCollection(key: string, item?: any, index = -1) {
    collectionKey.value = key; collectionIndex.value = index; clear(collectionDraft);
    const definition = collectionDefinitions.find((entry) => entry.key === key) || collectionDefinitions[0];
    const source = item ? JSON.parse(JSON.stringify(item)) : {};
    definition.fields.forEach((field) => {
      const value = source[field.key];
      collectionDraft[field.key] = field.kind === 'lines' ? (value || []).join('\n') : (value ?? '');
    });
    collectionVisible.value = true;
  }
  async function saveCollection() {
    const definition = activeCollectionDefinition.value;
    const missing = definition.fields.find((field) => field.required && !String(collectionDraft[field.key] || '').trim());
    if (missing) return createMessage.warning(`请填写${missing.label}`);
    const item: any = {};
    definition.fields.forEach((field) => { item[field.key] = field.kind === 'lines' ? lines(collectionDraft[field.key] || '') : collectionDraft[field.key]; });
    const list = siteContent.value[definition.key] || (siteContent.value[definition.key] = []);
    if (collectionIndex.value < 0) list.push(item); else list.splice(collectionIndex.value, 1, item);
    await persistTeam(`${definition.itemName}已保存并同步前台`); collectionVisible.value = false;
  }
  async function removeCollection(key: string, index: number) { siteContent.value[key].splice(index, 1); await persistTeam('内容已删除并同步前台'); }
  async function moveCollection(key: string, index: number, offset: number) {
    const target = index + offset; const list = siteContent.value[key]; if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1); list.splice(target, 0, item); await persistTeam('内容排序已更新');
  }
  async function uploadCollectionImage(key: string, options) {
    uploadingCollection.value = true;
    try {
      const result: any = await uploadSiteImage(options.file, options.onProgress); collectionDraft[key] = result?.url || result?.result?.url || '';
      if (!collectionDraft[key]) throw new Error('图片地址为空'); options.onSuccess?.(result); createMessage.success('图片上传成功');
    } catch (error) { options.onError?.(error); createMessage.error('图片上传失败'); }
    finally { uploadingCollection.value = false; }
  }
  async function loadWechat() { const result: any = await getLoginSettings(); Object.assign(wechat, result.wechat || {}, { appSecret: '' }); }
  async function submitWechat() { savingWechat.value = true; try { const result: any = await saveLoginSettings({ wechat: { ...wechat } }); Object.assign(wechat, result.settings?.wechat || wechat, { appSecret: '' }); createMessage.success('微信登录配置已保存'); } finally { savingWechat.value = false; } }
  async function loadSkills() { const result: any = await getSkills(); skills.value = result.skills || []; }
  function emptySkillModule(index = 0) {
    const order = String(index + 1).padStart(2, '0');
    return {
      accent: 'blue', description: '', id: `module-${Date.now()}-${index}`, materialsText: '', nextStep: '',
      order, outputsText: '', prompt: '', reference: '', shortTitle: '', status: '可继续生产', title: '',
    };
  }
  function openSkill(record?: any) {
    clear(skillDraft);
    Object.assign(skillDraft, record ? JSON.parse(JSON.stringify(record)) : { displayName: '', triggerName: '', category: '创作工具', description: '', owner: '平台团队', active: true, source: '平台', visibility: 'public', packageFiles: [] });
    skillModules.value = (record?.modules?.length ? record.modules : [emptySkillModule()]).map((module) => ({
      ...JSON.parse(JSON.stringify(module)), materialsText: (module.materials || []).join('\n'), outputsText: (module.outputs || []).join('\n'),
    }));
    skillVisible.value = true;
  }
  function addSkillModule() { skillModules.value.push(emptySkillModule(skillModules.value.length)); }
  function removeSkillModule(index: number) { if (skillModules.value.length <= 1) return createMessage.warning('一个 Skill 至少需要保留一个任务模块'); skillModules.value.splice(index, 1); }
  function moveSkillModule(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= skillModules.value.length) return; const [module] = skillModules.value.splice(index, 1); skillModules.value.splice(target, 0, module); }
  async function submitSkill() {
    if (!skillDraft.displayName?.trim()) return createMessage.warning('请填写 Skill 名称');
    if (!skillModules.value.length) return createMessage.warning('请至少添加一个任务模块');
    const invalid = skillModules.value.find((module) => !module.title?.trim() || !module.prompt?.trim());
    if (invalid) return createMessage.warning('请完整填写每个模块的名称和系统提示词');
    const modules = skillModules.value.map((module, index) => ({
      accent: module.accent || 'blue', description: module.description || '', id: module.id || `module-${Date.now()}-${index}`,
      materials: lines(module.materialsText || ''), nextStep: module.nextStep || '', order: module.order || String(index + 1).padStart(2, '0'),
      outputs: lines(module.outputsText || ''), prompt: module.prompt.trim(), reference: module.reference || '', shortTitle: module.shortTitle || module.title,
      status: module.status || '可继续生产', title: module.title.trim(),
    }));
    await saveSkill({ ...skillDraft, modules });
    skillVisible.value = false; createMessage.success(`Skill 已保存，${modules.length} 个模块已同步用户端`); await loadSkills();
  }
  async function removeSkill(id: string) { await deleteSkill(id); createMessage.success('Skill 已删除'); await loadSkills(); }
  async function loadModels() { const result: any = await getModelApis(); modelConfigs.value = result.configs || []; }
  function openModel(record?: any) { clear(modelDraft); Object.assign(modelDraft, record ? { ...record, apiKey: '' } : { name: '', provider: 'new-api', baseUrl: 'http://new-api:3000/v1', model: '', apiKey: '', temperature: 0.7, maxTokens: 1200, enabled: true, systemPrompt: '' }); modelVisible.value = true; }
  async function submitModel() { if (!modelDraft.name?.trim()) return createMessage.warning('请填写配置名称'); await saveModelApi({ ...modelDraft }); modelVisible.value = false; createMessage.success('模型接口已保存'); await loadModels(); }
  async function removeModel(id: string) { await deleteModelApi(id); createMessage.success('模型接口已删除'); await loadModels(); }
  async function loadTypes() { const result: any = await getProjectTypes(); projectTypes.value = result.types || []; }
  function openType(record?: any) { clear(typeDraft); Object.assign(typeDraft, record ? { ...record } : { label: '', category: '短剧漫剧', description: '', sortOrder: 0, active: true }); typeVisible.value = true; }
  async function submitType() { if (!typeDraft.label?.trim()) return createMessage.warning('请填写类型名称'); await saveProjectType({ ...typeDraft }); typeVisible.value = false; createMessage.success('项目类型已保存'); await loadTypes(); }
  async function removeType(id: string) { await deleteProjectType(id); createMessage.success('项目类型已删除'); await loadTypes(); }
  onMounted(async () => { await Promise.all([loadTeam(), loadWechat(), loadSkills(), loadModels(), loadTypes()]); });
</script>

<style scoped>
  .platform-hero { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .page-title { font-size: 20px; font-weight: 700; }
  .page-subtitle { margin-top: 4px; color: var(--text-color-secondary); font-size: 13px; font-weight: 400; }
  .section-context { display: flex; align-items: center; gap: 14px; margin: -2px 0 10px; padding: 12px 16px; border: 1px solid rgba(82, 211, 226, 0.2); border-radius: 12px; background: linear-gradient(110deg, rgba(31, 205, 223, 0.1), rgba(31, 205, 223, 0.02)); }
  .section-context__back { flex: none; padding: 0; color: #3ecddd; }
  .section-context__copy { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
  .section-context__copy small { color: var(--text-color-secondary); }
  .section-context__copy strong { flex: none; }
  .section-context__copy span { color: var(--text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .admin-overview { padding: 4px 0 12px; }
  .admin-overview__intro { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 28px 30px; border: 1px solid rgba(76, 221, 233, 0.25); border-radius: 18px; background: radial-gradient(circle at 90% 10%, rgba(61, 218, 232, 0.14), transparent 36%), linear-gradient(135deg, rgba(5, 33, 47, 0.9), rgba(9, 23, 36, 0.72)); color: #f5fdff; }
  .admin-overview__intro small { color: #5edcea; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; }
  .admin-overview__intro h2 { margin: 8px 0 5px; color: inherit; font-size: 25px; }
  .admin-overview__intro p { max-width: 650px; margin: 0; color: rgba(222, 241, 245, 0.66); line-height: 1.75; }
  .admin-overview__search { width: min(420px, 40%); flex: none; }
  .admin-overview__guide { display: flex; flex-wrap: wrap; gap: 10px 24px; margin: 18px 2px; color: var(--text-color-secondary); font-size: 13px; }
  .admin-overview__guide span { display: inline-flex; align-items: center; gap: 8px; }
  .admin-overview__guide i { width: 7px; height: 7px; border-radius: 50%; background: #42d5e3; box-shadow: 0 0 12px rgba(66, 213, 227, 0.75); }
  .admin-section-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
  .admin-section-card { display: flex; min-height: 226px; padding: 20px; border: 1px solid var(--border-color-base); border-radius: 16px; background: var(--component-background); cursor: pointer; flex-direction: column; transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease; }
  .admin-section-card:hover { border-color: rgba(66, 213, 227, 0.65); box-shadow: 0 14px 35px rgba(0, 15, 23, 0.16); transform: translateY(-3px); }
  .admin-section-card__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .admin-section-card__icon { display: inline-flex; width: 42px; height: 42px; align-items: center; justify-content: center; border: 1px solid rgba(66, 213, 227, 0.35); border-radius: 12px; background: rgba(66, 213, 227, 0.09); color: #38c7d7; font-size: 17px; font-weight: 700; }
  .admin-section-card__body { flex: 1; }
  .admin-section-card__body h3 { margin: 18px 0 8px; font-size: 18px; }
  .admin-section-card__body p { margin: 0; color: var(--text-color-secondary); line-height: 1.7; }
  .admin-section-card__footer { display: flex; min-height: 34px; align-items: center; justify-content: space-between; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color-base); }
  .admin-section-card__footer > span { min-width: 0; color: var(--text-color-secondary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .admin-section-card__action { flex: none; padding: 0; color: #38c7d7; }
  .admin-overview__empty { padding: 56px 0; }
  .section-toolbar { display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .section-toolbar :deep(.ant-alert) { flex: 1; }
  .person-card { margin-bottom: 16px; min-height: 230px; }
  .person-head { display: flex; gap: 14px; align-items: center; }
  .person-copy { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .person-copy strong { font-size: 17px; }
  .person-copy span { color: var(--text-color-secondary); }
  .person-bio { height: 66px; margin: 16px 0; color: var(--text-color-secondary); overflow: hidden; }
  .settings-form { max-width: 980px; }
  .copy-grid { display: grid; gap: 0 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .copy-grid :deep(.ant-form-item:has(textarea)) { grid-column: 1 / -1; }
  .field-key { display: block; margin-top: 5px; color: var(--text-color-secondary); font-family: monospace; }
  .inline-editor-row { display: grid; gap: 10px; grid-template-columns: 1fr 1fr auto; margin-bottom: 10px; }
  .content-card { margin-bottom: 16px; min-height: 210px; }
  .content-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .content-card__head > div { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .content-card__head strong { font-size: 17px; }
  .content-card__head span, .content-card > :deep(.ant-card-body) > p { color: var(--text-color-secondary); }
  .content-card > :deep(.ant-card-body) > p { min-height: 66px; margin: 16px 0; overflow: hidden; }
  .upload-row { display: flex; gap: 12px; align-items: center; }
  .upload-row :deep(.ant-input) { flex: 1; }
  .module-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 14px; }
  .module-toolbar p { margin: 4px 0 0; color: var(--text-color-secondary); font-size: 13px; font-weight: 400; }
  .skill-module-editor { margin-bottom: 16px; padding: 18px; border: 1px solid var(--border-color-base); border-radius: 12px; background: var(--component-background); }
  .skill-module-editor__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color-base); }
  .skill-module-editor__head > div { display: flex; align-items: center; gap: 8px; }
  @media (max-width: 768px) {
    .platform-hero, .section-toolbar, .upload-row, .admin-overview__intro { align-items: stretch; flex-direction: column; }
    .section-context { align-items: flex-start; flex-direction: column; }
    .section-context__copy { align-items: flex-start; flex-direction: column; gap: 3px; }
    .section-context__copy span { white-space: normal; }
    .admin-overview__intro { gap: 20px; padding: 22px 20px; }
    .admin-overview__search { width: 100%; }
    .admin-section-grid { grid-template-columns: 1fr; }
    .copy-grid { grid-template-columns: 1fr; }
    .inline-editor-row { grid-template-columns: 1fr; }
  }
</style>
