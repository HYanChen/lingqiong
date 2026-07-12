#!/usr/bin/with-contenv bash
set -euo pipefail

cat >/tmp/wcu-bookstack-head.html <<'HTML'
<style>
  :root,
  :root.dark-mode {
    --color-primary: #0f3f46;
    --color-primary-light: rgba(103, 232, 249, 0.14);
    --color-link: #9befff;
    --color-link-light: #c7f9ff;
    --color-page: #8be9f8;
    --color-book: #68e1d7;
    --color-chapter: #e7a763;
    --color-bookshelf: #6ee7f9;
    --wcu-bg: #050506;
    --wcu-panel: rgba(255, 255, 255, 0.055);
    --wcu-panel-strong: rgba(255, 255, 255, 0.085);
    --wcu-border: rgba(255, 255, 255, 0.13);
    --wcu-text: #f5f7f8;
    --wcu-muted: rgba(245, 247, 248, 0.62);
    --wcu-faint: rgba(245, 247, 248, 0.42);
    --wcu-cyan: #a5f3fc;
  }

  html {
    background: #050506 !important;
  }

  html:not(.dark-mode) {
    color-scheme: dark;
  }

  body {
    min-height: 100vh;
    background:
      radial-gradient(circle at 14% 10%, rgba(34, 211, 238, 0.18), transparent 28rem),
      radial-gradient(circle at 86% 16%, rgba(180, 83, 9, 0.12), transparent 30rem),
      linear-gradient(180deg, rgba(9, 9, 11, 0.92), #050506 62%) !important;
    color: var(--wcu-text) !important;
  }

  body::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: -1;
    background-image:
      linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: linear-gradient(to bottom, rgba(0,0,0,0.88), transparent 82%);
    opacity: 0.26;
  }

  #header.primary-background {
    min-height: 76px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.11);
    background: rgba(5, 5, 6, 0.82) !important;
    backdrop-filter: blur(22px);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.34);
  }

  #header .logo {
    gap: 14px;
    color: #fff !important;
    text-decoration: none !important;
  }

  #header .logo-image {
    display: none !important;
  }

  #header .logo::before {
    content: "✧";
    display: inline-grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: 1px solid rgba(103, 232, 249, 0.45);
    border-radius: 8px;
    background: rgba(34, 211, 238, 0.12);
    color: #d9fbff;
    font-size: 24px;
    box-shadow: 0 0 28px rgba(34, 211, 238, 0.16);
  }

  #header .logo-text {
    color: #f8fafc !important;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  #header .logo-text::after {
    content: "WAR CHRONICLE UNIVERSE";
    display: block;
    margin-top: 3px;
    color: rgba(224, 242, 254, 0.64);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.28em;
  }

  #content,
  .scroll-body,
  .content,
  .flex-fill {
    background: transparent !important;
  }

  .container {
    max-width: 1180px;
  }

  .card,
  .book-content,
  .page-content,
  .chapter-content,
  .shelf-content,
  .tri-layout-left,
  .tri-layout-middle,
  .tri-layout-right,
  .setting-list,
  .entity-list-item,
  .global-search-suggestions {
    border: 1px solid var(--wcu-border) !important;
    border-radius: 8px !important;
    background: var(--wcu-panel) !important;
    color: var(--wcu-text) !important;
    box-shadow: none !important;
  }

  .card:hover,
  .entity-list-item:hover {
    border-color: rgba(165, 243, 252, 0.34) !important;
    background: var(--wcu-panel-strong) !important;
  }

  .card-title,
  h1, h2, h3, h4, h5,
  .list-heading,
  .entity-list-item-name,
  .entity-list-item .name,
  .page-title,
  .book-title {
    color: #f8fafc !important;
    letter-spacing: 0 !important;
  }

  p,
  .text-muted,
  .small,
  .entity-item-snippet,
  .entity-list-item p,
  .breadcrumb-listing,
  .breadcrumbs,
  .subheader,
  .meta,
  label {
    color: var(--wcu-muted) !important;
  }

  a,
  .text-link,
  .icon-list-item.text-link {
    color: var(--wcu-cyan) !important;
  }

  a:hover,
  .text-link:hover,
  .icon-list-item.text-link:hover {
    color: #ffffff !important;
    text-decoration-color: rgba(165, 243, 252, 0.6) !important;
  }

  #header .header-links a,
  #header .mobile-menu-toggle,
  #header .text-button,
  #header button {
    border-radius: 8px !important;
    color: rgba(248, 250, 252, 0.84) !important;
  }

  #header .header-links a:hover,
  #header .mobile-menu-toggle:hover {
    background: rgba(255, 255, 255, 0.08) !important;
    color: #fff !important;
  }

  #header a[href$="/login"] {
    display: none !important;
  }

  .wcu-home-link {
    display: inline-flex !important;
    align-items: center;
    gap: 8px;
    margin-left: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px !important;
    padding: 10px 14px !important;
    color: #f8fafc !important;
    font-weight: 600;
    text-decoration: none !important;
  }

  .wcu-home-link:hover {
    border-color: rgba(165, 243, 252, 0.45);
    background: rgba(165, 243, 252, 0.10) !important;
  }

  .search-box,
  input,
  select,
  textarea,
  .input-base {
    border-color: rgba(255, 255, 255, 0.13) !important;
    border-radius: 8px !important;
    background: rgba(0, 0, 0, 0.32) !important;
    color: #f8fafc !important;
  }

  .search-box input::placeholder,
  input::placeholder,
  textarea::placeholder {
    color: rgba(245, 247, 248, 0.38) !important;
  }

  button,
  .button,
  input[type="submit"],
  .button-base {
    border-radius: 8px !important;
  }

  .button.primary,
  input[type="submit"].button,
  .primary-background {
    background: rgba(34, 211, 238, 0.16) !important;
    color: #ecfeff !important;
  }

  .icon-list-item .svg-icon,
  .entity-list-item .svg-icon,
  #header .svg-icon {
    color: currentColor !important;
    fill: currentColor !important;
  }

  .entity-list.compact .entity-list-item,
  .entity-list-item {
    margin-bottom: 10px !important;
    padding: 14px !important;
  }

  .entity-list.compact .entity-list-item:first-child {
    border-top: 1px solid var(--wcu-border) !important;
  }

  .breadcrumb-listing,
  .breadcrumbs {
    border-color: rgba(255, 255, 255, 0.10) !important;
  }

  hr,
  .card-separator,
  .grid-card-content,
  .grid-card-footer {
    border-color: rgba(255, 255, 255, 0.10) !important;
  }

  .back-to-top .inner {
    border: 1px solid rgba(103, 232, 249, 0.32);
    border-radius: 8px;
    background: rgba(5, 5, 6, 0.86);
    color: #ecfeff;
  }

  footer,
  .footer {
    border-top: 1px solid rgba(255, 255, 255, 0.10) !important;
    background: rgba(5, 5, 6, 0.76) !important;
    color: var(--wcu-faint) !important;
  }

  @media (max-width: 900px) {
    #header.primary-background {
      min-height: 68px;
      padding-left: 18px !important;
      padding-right: 18px !important;
    }

    #header .logo-text {
      font-size: 20px;
    }

    #header .logo::before {
      width: 40px;
      height: 40px;
    }
  }
</style>
<script>
  document.documentElement.classList.add("dark-mode");
  window.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("wcu-bookstack-theme");
    var links = document.querySelector("#header .header-links .links");
    if (links && !links.querySelector(".wcu-home-link")) {
      var home = document.createElement("a");
      home.className = "wcu-home-link";
      home.href = "/";
      home.textContent = "返回战纪宇宙";
      links.prepend(home);
    }
  });
</script>
HTML

php /app/www/artisan tinker --execute='
$theme = file_get_contents("/tmp/wcu-bookstack-head.html");
setting()->put("app-name", getenv("BOOKSTACK_BRAND_NAME") ?: "灵穹知识库");
setting()->put("app-name-header", "true");
setting()->put("app-color", getenv("BOOKSTACK_BRAND_COLOR") ?: "#0f3f46");
setting()->put("app-color-light", "rgba(103,232,249,0.14)");
setting()->put("app-color-dark", "#0f3f46");
setting()->put("app-color-light-dark", "rgba(103,232,249,0.14)");
setting()->put("link-color", getenv("BOOKSTACK_LINK_COLOR") ?: "#9befff");
setting()->put("link-color-dark", getenv("BOOKSTACK_LINK_COLOR") ?: "#9befff");
setting()->put("app-public", "true");
setting()->put("registration-enabled", "false");
setting()->put("registration-role", "2");
setting()->put("app-custom-head", $theme);

\BookStack\Users\Models\Role::query()->where("id", 1)->update(["external_auth_id" => "admin"]);
\BookStack\Users\Models\Role::query()->where("id", 2)->update(["external_auth_id" => "creator"]);

$adminRoleId = 1;
\BookStack\Users\Models\User::query()
    ->where("external_auth_id", "like", "admin:%")
    ->orWhere("email", "admin@lingqiong.local")
    ->get()
    ->each(function ($user) use ($adminRoleId) {
        $user->roles()->syncWithoutDetaching([$adminRoleId]);
    });
' >/dev/null

php /app/www/artisan cache:clear >/dev/null

echo "[bookstack-brand] Applied ${BOOKSTACK_BRAND_NAME:-灵穹知识库} theme"
