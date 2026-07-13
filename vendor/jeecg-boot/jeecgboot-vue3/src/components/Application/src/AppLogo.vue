<!--
 * @Author: Jeecg
 * @Description: logo component
-->
<template>
  <div class="anticon" :class="getAppLogoClass" @click="goHome">
    <span class="lingqiong-logo-mark">✦</span>
    <div class="lingqiong-logo-copy ml-2 truncate md:opacity-100" :class="getTitleClass" v-show="showTitle">
      <strong>战纪宇宙</strong>
      <small>WAR CHRONICLE UNIVERSE</small>
    </div>
  </div>
</template>
<script lang="ts" setup>
  import { computed, unref } from 'vue';
  import { useGlobSetting } from '/@/hooks/setting';
  import { useGo } from '/@/hooks/web/usePage';
  import { useMenuSetting } from '/@/hooks/setting/useMenuSetting';
  import { useDesign } from '/@/hooks/web/useDesign';
  import { PageEnum } from '/@/enums/pageEnum';
  import { useUserStore } from '/@/store/modules/user';

  const props = defineProps({
    /**
     * The theme of the current parent component
     */
    theme: { type: String, validator: (v: string) => ['light', 'dark'].includes(v) },
    /**
     * Whether to show title
     */
    showTitle: { type: Boolean, default: true },
    /**
     * The title is also displayed when the menu is collapsed
     */
    alwaysShowTitle: { type: Boolean },
  });

  const { prefixCls } = useDesign('app-logo');
  const { getCollapsedShowTitle } = useMenuSetting();
  const userStore = useUserStore();
  useGlobSetting();
  
  const go = useGo();

  const getAppLogoClass = computed(() => [prefixCls, props.theme, { 'collapsed-show-title': unref(getCollapsedShowTitle) }]);

  const getTitleClass = computed(() => [
    `${prefixCls}__title`,
    {
      'xs:opacity-0': !props.alwaysShowTitle,
    },
  ]);

  function goHome() {
    go(userStore.getUserInfo.homePath || PageEnum.BASE_HOME);
  }
</script>
<style lang="less" scoped>
  @prefix-cls: ~'@{namespace}-app-logo';

  .@{prefix-cls} {
    display: flex;
    align-items: center;
    padding-left: 7px;
    cursor: pointer;
    transition: all 0.2s ease;
    //左侧菜单模式和左侧菜单混合模式加渐变背景色
    &.jeecg-layout-mix-sider-logo,&.jeecg-layout-menu-logo{
      background:@sider-logo-bg-color;
    }
    // &.light {
    //   border-bottom: 1px solid @border-color-base;
    // }

    &.collapsed-show-title {
      padding-left: 20px;
    }

    &.light &__title {
      color: @primary-color;
    }

    &.dark &__title {
      color: @white;
    }

    &__title {
      font-size: 16px;
      font-weight: 650;
      transition: all 0.5s;
      line-height: normal;
    }

    .lingqiong-logo-mark {
      display: grid;
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      place-items: center;
      border: 1px solid rgba(103, 232, 249, 0.45);
      border-radius: 11px;
      color: #67e8f9;
      background: linear-gradient(145deg, rgba(34, 211, 238, 0.18), rgba(8, 47, 73, 0.42));
      box-shadow: 0 0 24px rgba(34, 211, 238, 0.1);
    }

    .lingqiong-logo-copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: #f8fafc;

      strong { font-size: 15px; letter-spacing: 0.05em; }
      small { color: #64748b; font-size: 7px; letter-spacing: 0.18em; }
    }
  }
</style>
