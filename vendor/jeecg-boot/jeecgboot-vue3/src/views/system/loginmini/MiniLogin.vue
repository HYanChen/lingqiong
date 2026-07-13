<template>
  <main class="lingqiong-login">
    <div class="lingqiong-login__grid" aria-hidden="true"></div>
    <div class="lingqiong-login__glow lingqiong-login__glow--cyan" aria-hidden="true"></div>
    <div class="lingqiong-login__glow lingqiong-login__glow--amber" aria-hidden="true"></div>

    <header class="lingqiong-login__header">
      <a class="lingqiong-brand" href="https://pla.wiki/" aria-label="返回灵穹官网">
        <span class="lingqiong-brand__mark">✦</span>
        <span>
          <strong>灵穹</strong>
          <small>LINGQIONG AI STUDIO</small>
        </span>
      </a>
      <a class="lingqiong-login__back" href="https://pla.wiki/">返回官网</a>
    </header>

    <section class="lingqiong-login__content">
      <div class="lingqiong-login__intro">
        <span class="lingqiong-kicker">OPERATIONS CENTER</span>
        <h1>灵穹运营<br />管理平台</h1>
        <p>统一管理官网内容、创作者、项目生产、模型能力、知识资产与平台账务。</p>
        <div class="lingqiong-login__capabilities">
          <span>官网与内容</span>
          <span>项目生产</span>
          <span>模型与账务</span>
          <span>知识资产</span>
        </div>
        <div class="lingqiong-login__status">
          <i></i>
          <span>业务数据与灵穹前台实时同步</span>
        </div>
      </div>

      <div class="lingqiong-login__panel">
        <div class="lingqiong-login__panel-head">
          <span class="lingqiong-kicker">ADMIN ACCESS</span>
          <h2>管理员登录</h2>
          <p>使用灵穹后台管理员账号进入运营中心</p>
        </div>

        <a-form class="lingqiong-login__form" :model="formData" @keyup.enter="accountLogin">
          <label>管理员账号</label>
          <a-input v-model:value="formData.username" class="lingqiong-login__input" size="large" placeholder="请输入管理员账号" autocomplete="username">
            <template #prefix><span class="lingqiong-login__input-icon">◎</span></template>
          </a-input>

          <label>登录密码</label>
          <a-input-password v-model:value="formData.password" class="lingqiong-login__input" size="large" placeholder="请输入登录密码" autocomplete="current-password">
            <template #prefix><span class="lingqiong-login__input-icon">◇</span></template>
          </a-input-password>

          <label>安全验证码</label>
          <div class="lingqiong-login__captcha-row">
            <a-input v-model:value="formData.inputCode" class="lingqiong-login__input" size="large" placeholder="输入验证码" maxlength="8" />
            <button class="lingqiong-login__captcha" type="button" title="点击刷新验证码" @click="handleChangeCheckCode">
              <img v-if="randCodeData.requestCodeSuccess" :src="randCodeData.randCodeImage" alt="登录验证码" />
              <span v-else>刷新验证码</span>
            </button>
          </div>

          <div class="lingqiong-login__options">
            <a-checkbox v-model:checked="rememberMe">记住管理员账号</a-checkbox>
            <span>独立后台权限验证</span>
          </div>

          <a-button class="lingqiong-login__submit" type="primary" size="large" :loading="loginLoading" block @click="accountLogin">
            进入运营管理平台
          </a-button>
        </a-form>

        <div class="lingqiong-login__security">
          <span>盾</span>
          <p><strong>前后台账号相互隔离</strong>前台创作者账号不会获得后台管理权限。</p>
        </div>
      </div>
    </section>

    <footer class="lingqiong-login__footer">
      <span>© 2026 长沙灵穹数字科技有限公司</span>
      <span>WAR CHRONICLE UNIVERSE · OPERATIONS</span>
    </footer>
  </main>
</template>

<script lang="ts" setup name="login-mini">
  import { onMounted, reactive, ref, toRaw } from 'vue';
  import { getCodeInfo } from '/@/api/sys/user';
  import { useUserStore } from '/@/store/modules/user';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { createLocalStorage } from '/@/utils/cache';
  import { encryptAESCBC } from '/@/utils/cipher';

  defineProps({ sessionTimeout: { type: Boolean } });

  const { notification, createMessage } = useMessage();
  const userStore = useUserStore();
  const storage = createLocalStorage();
  const rememberMe = ref(false);
  const loginLoading = ref(false);
  const rememberKey = 'LINGQIONG_ADMIN_REMEMBER_USERNAME';
  const formData = reactive({ username: 'admin', password: '', inputCode: '' });
  const randCodeData = reactive({ randCodeImage: '', requestCodeSuccess: false, checkKey: '' });

  function handleChangeCheckCode() {
    formData.inputCode = '';
    randCodeData.requestCodeSuccess = false;
    randCodeData.checkKey = `${Date.now()}${Math.random().toString(36).slice(-4)}`;
    getCodeInfo(randCodeData.checkKey).then((image) => {
      randCodeData.randCodeImage = image;
      randCodeData.requestCodeSuccess = true;
    });
  }

  async function accountLogin() {
    if (!formData.username.trim()) return createMessage.warning('请输入管理员账号');
    if (!formData.password) return createMessage.warning('请输入登录密码');
    if (!formData.inputCode.trim()) return createMessage.warning('请输入安全验证码');

    try {
      loginLoading.value = true;
      const { userInfo } = await userStore.login(
        toRaw({
          username: formData.username.trim(),
          password: encryptAESCBC(formData.password),
          captcha: formData.inputCode.trim(),
          checkKey: randCodeData.checkKey,
          mode: 'none',
        }),
      );
      if (rememberMe.value) storage.set(rememberKey, formData.username.trim());
      else storage.remove(rememberKey);
      if (userInfo) {
        notification.success({
          message: '登录成功',
          description: `欢迎进入灵穹运营管理平台，${userInfo.realname || userInfo.username || '管理员'}`,
          duration: 3,
        });
      }
    } catch (error: any) {
      notification.error({ message: '登录失败', description: error?.message || '请检查账号、密码和验证码', duration: 3 });
      handleChangeCheckCode();
    } finally {
      loginLoading.value = false;
    }
  }

  onMounted(() => {
    handleChangeCheckCode();
    const saved = storage.get(rememberKey);
    if (saved) {
      formData.username = saved;
      rememberMe.value = true;
    }
  });
</script>

<style lang="less" scoped>
  .lingqiong-login {
    --cyan: #67e8f9;
    --cyan-deep: #22d3ee;
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    color: #f8fafc;
    background: #030609;
    font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
  }

  .lingqiong-login__grid {
    position: absolute;
    inset: 0;
    opacity: 0.22;
    background-image: linear-gradient(rgba(103, 232, 249, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(103, 232, 249, 0.08) 1px, transparent 1px);
    background-size: 72px 72px;
    mask-image: linear-gradient(to bottom, black, transparent 85%);
  }

  .lingqiong-login__glow { position: absolute; width: 42vw; height: 42vw; border-radius: 50%; filter: blur(120px); opacity: 0.13; }
  .lingqiong-login__glow--cyan { top: -24vw; left: -10vw; background: #22d3ee; }
  .lingqiong-login__glow--amber { right: -20vw; bottom: -26vw; background: #f59e0b; }

  .lingqiong-login__header,
  .lingqiong-login__footer { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
  .lingqiong-login__header { height: 92px; border-bottom: 1px solid rgba(148, 163, 184, 0.14); }
  .lingqiong-brand { display: flex; align-items: center; gap: 14px; color: #fff; }
  .lingqiong-brand:hover { color: #fff; }
  .lingqiong-brand__mark { display: grid; width: 48px; height: 48px; place-items: center; border: 1px solid rgba(103, 232, 249, 0.5); border-radius: 14px; color: var(--cyan); background: linear-gradient(145deg, rgba(34, 211, 238, 0.18), rgba(8, 47, 73, 0.45)); box-shadow: 0 0 32px rgba(34, 211, 238, 0.13); font-size: 24px; }
  .lingqiong-brand strong { display: block; font-size: 21px; letter-spacing: 0.08em; }
  .lingqiong-brand small { display: block; margin-top: 2px; color: #94a3b8; font-size: 9px; letter-spacing: 0.28em; }
  .lingqiong-login__back { padding: 10px 16px; border: 1px solid rgba(148, 163, 184, 0.24); border-radius: 10px; color: #cbd5e1; background: rgba(15, 23, 42, 0.42); }
  .lingqiong-login__back:hover { border-color: rgba(103, 232, 249, 0.45); color: var(--cyan); }

  .lingqiong-login__content { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(400px, 0.8fr); gap: 80px; align-items: center; width: min(1120px, calc(100% - 48px)); min-height: calc(100vh - 174px); margin: 0 auto; padding: 54px 0; }
  .lingqiong-kicker { color: var(--cyan); font-size: 11px; font-weight: 700; letter-spacing: 0.32em; }
  .lingqiong-login__intro h1 { margin: 22px 0; color: #fff; font-size: clamp(48px, 7vw, 84px); font-weight: 650; line-height: 1.05; letter-spacing: -0.045em; }
  .lingqiong-login__intro > p { max-width: 600px; margin: 0; color: #94a3b8; font-size: 18px; line-height: 1.9; }
  .lingqiong-login__capabilities { display: grid; grid-template-columns: repeat(2, minmax(0, 190px)); gap: 12px; margin-top: 36px; }
  .lingqiong-login__capabilities span { padding: 13px 16px; border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 10px; color: #cbd5e1; background: rgba(8, 15, 24, 0.72); }
  .lingqiong-login__capabilities span::before { content: '✦'; margin-right: 10px; color: var(--cyan); }
  .lingqiong-login__status { display: flex; align-items: center; gap: 10px; margin-top: 30px; color: #64748b; font-size: 13px; }
  .lingqiong-login__status i { width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 16px #34d399; }

  .lingqiong-login__panel { padding: 34px; border: 1px solid rgba(103, 232, 249, 0.2); border-radius: 22px; background: linear-gradient(145deg, rgba(10, 18, 29, 0.96), rgba(5, 10, 17, 0.94)); box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42), inset 0 1px rgba(255, 255, 255, 0.04); backdrop-filter: blur(24px); }
  .lingqiong-login__panel-head h2 { margin: 10px 0 5px; color: #fff; font-size: 30px; }
  .lingqiong-login__panel-head p { margin: 0 0 28px; color: #64748b; }
  .lingqiong-login__form label { display: block; margin: 17px 0 8px; color: #cbd5e1; font-size: 13px; font-weight: 600; }
  .lingqiong-login__input { height: 48px; border-color: rgba(148, 163, 184, 0.18); border-radius: 10px; color: #f8fafc; background: rgba(2, 6, 12, 0.78); }
  .lingqiong-login__input:hover, .lingqiong-login__input:focus, .lingqiong-login__input:focus-within { border-color: rgba(103, 232, 249, 0.55); box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.08); }
  .lingqiong-login__input-icon { margin-right: 4px; color: #64748b; }
  .lingqiong-login__captcha-row { display: grid; grid-template-columns: 1fr 126px; gap: 10px; }
  .lingqiong-login__captcha { height: 48px; overflow: hidden; border: 1px solid rgba(103, 232, 249, 0.2); border-radius: 10px; color: #94a3b8; background: rgba(2, 6, 12, 0.78); cursor: pointer; }
  .lingqiong-login__captcha img { width: 100%; height: 100%; object-fit: cover; }
  .lingqiong-login__options { display: flex; align-items: center; justify-content: space-between; margin: 18px 0; color: #64748b; font-size: 12px; }
  .lingqiong-login__submit { height: 50px; border: 0; border-radius: 10px; color: #06212a; background: linear-gradient(135deg, #67e8f9, #22d3ee); box-shadow: 0 12px 30px rgba(34, 211, 238, 0.16); font-weight: 700; }
  .lingqiong-login__submit:hover { color: #03171e; background: linear-gradient(135deg, #a5f3fc, #67e8f9); }
  .lingqiong-login__security { display: flex; gap: 12px; margin-top: 22px; padding-top: 20px; border-top: 1px solid rgba(148, 163, 184, 0.12); color: #64748b; }
  .lingqiong-login__security > span { display: grid; flex: 0 0 34px; height: 34px; place-items: center; border-radius: 9px; color: var(--cyan); background: rgba(34, 211, 238, 0.09); font-size: 11px; }
  .lingqiong-login__security p { margin: 0; font-size: 12px; line-height: 1.65; }
  .lingqiong-login__security strong { display: block; color: #cbd5e1; font-size: 13px; }
  .lingqiong-login__footer { height: 82px; color: #475569; font-size: 11px; letter-spacing: 0.08em; }

  :deep(.ant-input), :deep(.ant-input-password input) { color: #f8fafc !important; background: transparent !important; }
  :deep(.ant-input::placeholder), :deep(.ant-input-password input::placeholder) { color: #475569; }
  :deep(.ant-checkbox-wrapper) { color: #94a3b8; }

  @media (max-width: 900px) {
    .lingqiong-login__content { grid-template-columns: 1fr; gap: 36px; padding-top: 36px; }
    .lingqiong-login__intro { text-align: center; }
    .lingqiong-login__intro h1 { font-size: 48px; }
    .lingqiong-login__intro > p { margin-inline: auto; }
    .lingqiong-login__capabilities { justify-content: center; margin-inline: auto; }
    .lingqiong-login__status { justify-content: center; }
  }
  @media (max-width: 560px) {
    .lingqiong-login__header, .lingqiong-login__footer, .lingqiong-login__content { width: min(100% - 28px, 1120px); }
    .lingqiong-login__header { height: 76px; }
    .lingqiong-login__back { display: none; }
    .lingqiong-login__intro { display: none; }
    .lingqiong-login__content { min-height: calc(100vh - 150px); padding: 28px 0; }
    .lingqiong-login__panel { padding: 24px 20px; border-radius: 18px; }
    .lingqiong-login__footer { height: 74px; flex-direction: column; justify-content: center; gap: 4px; text-align: center; }
  }
</style>
