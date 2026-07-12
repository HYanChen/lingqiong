import { getFirstRow, readDatabase, writeDatabase } from "@/lib/database";

const LOGIN_SETTINGS_KEY = "global";

export type WechatLoginMode = "local-scan" | "official";
export type OAuthProviderId = "apple" | "github" | "google";

export type WechatLoginSettings = {
  appId: string;
  appSecret: string;
  defaultAccount: string;
  defaultContact: string;
  enabled: boolean;
  mode: WechatLoginMode;
  qrHint: string;
  qrTitle: string;
};

export type OAuthLoginSettings = {
  accountClaim: string;
  authorizeUrl: string;
  clientId: string;
  clientSecret: string;
  contactClaim: string;
  enabled: boolean;
  label: string;
  scopes: string;
  tokenUrl: string;
  userInfoUrl: string;
};

export type LoginSettings = {
  oauth: Record<OAuthProviderId, OAuthLoginSettings>;
  wechat: WechatLoginSettings;
};

export type PublicLoginSettings = {
  oauth: Array<
    Omit<OAuthLoginSettings, "clientSecret"> & {
      configured: boolean;
      provider: OAuthProviderId;
    }
  >;
  wechat: Omit<WechatLoginSettings, "appSecret">;
};

export type AdminLoginSettings = {
  oauth: Record<
    OAuthProviderId,
    Omit<OAuthLoginSettings, "clientSecret"> & {
      clientSecretConfigured: boolean;
    }
  >;
  wechat: Omit<WechatLoginSettings, "appSecret"> & {
    appSecretConfigured: boolean;
  };
};

type LoginSettingsRow = {
  json: string;
  updated_at: string;
};

export const defaultLoginSettings: LoginSettings = {
  oauth: {
    apple: {
      accountClaim: "name|email|sub",
      authorizeUrl: "https://appleid.apple.com/auth/authorize",
      clientId: "",
      clientSecret: "",
      contactClaim: "email|sub",
      enabled: false,
      label: "Apple",
      scopes: "name email",
      tokenUrl: "https://appleid.apple.com/auth/token",
      userInfoUrl: ""
    },
    github: {
      accountClaim: "name|login",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      clientId: "",
      clientSecret: "",
      contactClaim: "email|login",
      enabled: false,
      label: "GitHub",
      scopes: "read:user user:email",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user"
    },
    google: {
      accountClaim: "name|email",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      clientId: "",
      clientSecret: "",
      contactClaim: "email|sub",
      enabled: false,
      label: "Google",
      scopes: "openid profile email",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo"
    }
  },
  wechat: {
    appId: "",
    appSecret: "",
    defaultAccount: "微信创作者",
    defaultContact: "wechat-user",
    enabled: false,
    mode: "local-scan",
    qrHint: "使用微信扫一扫，打开确认页后即可进入战纪宇宙统一平台。",
    qrTitle: "微信扫码登录"
  }
};

export const oauthProviderIds: OAuthProviderId[] = ["google", "github", "apple"];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function modeValue(value: unknown, fallback: WechatLoginMode) {
  return value === "official" || value === "local-scan" ? value : fallback;
}

function normalizeOAuthProvider(
  value: unknown,
  fallback: OAuthLoginSettings
): OAuthLoginSettings {
  const input = isObject(value) ? value : {};

  return {
    accountClaim: stringValue(input.accountClaim, fallback.accountClaim),
    authorizeUrl: stringValue(input.authorizeUrl, fallback.authorizeUrl),
    clientId: stringValue(input.clientId, fallback.clientId),
    clientSecret: stringValue(input.clientSecret, fallback.clientSecret),
    contactClaim: stringValue(input.contactClaim, fallback.contactClaim),
    enabled: booleanValue(input.enabled, fallback.enabled),
    label: stringValue(input.label, fallback.label),
    scopes: stringValue(input.scopes, fallback.scopes),
    tokenUrl: stringValue(input.tokenUrl, fallback.tokenUrl),
    userInfoUrl: stringValue(input.userInfoUrl, fallback.userInfoUrl)
  };
}

export function normalizeLoginSettings(value: unknown): LoginSettings {
  const root = isObject(value) ? value : {};
  const wechat = isObject(root.wechat) ? root.wechat : {};
  const defaults = defaultLoginSettings.wechat;
  const oauth = isObject(root.oauth) ? root.oauth : {};

  return {
    oauth: {
      apple: normalizeOAuthProvider(oauth.apple, defaultLoginSettings.oauth.apple),
      github: normalizeOAuthProvider(oauth.github, defaultLoginSettings.oauth.github),
      google: normalizeOAuthProvider(oauth.google, defaultLoginSettings.oauth.google)
    },
    wechat: {
      appId: stringValue(wechat.appId, defaults.appId),
      appSecret: stringValue(wechat.appSecret, defaults.appSecret),
      defaultAccount: stringValue(wechat.defaultAccount, defaults.defaultAccount),
      defaultContact: stringValue(wechat.defaultContact, defaults.defaultContact),
      enabled: booleanValue(wechat.enabled, defaults.enabled),
      mode: modeValue(wechat.mode, defaults.mode),
      qrHint: stringValue(wechat.qrHint, defaults.qrHint),
      qrTitle: stringValue(wechat.qrTitle, defaults.qrTitle)
    }
  };
}

export function toPublicLoginSettings(settings: LoginSettings): PublicLoginSettings {
  return {
    oauth: oauthProviderIds.map((provider) => {
      const oauth = settings.oauth[provider];

      return {
        accountClaim: oauth.accountClaim,
        authorizeUrl: oauth.authorizeUrl,
        clientId: oauth.clientId,
        configured: Boolean(
          oauth.enabled &&
            oauth.clientId.trim() &&
            oauth.clientSecret.trim() &&
            oauth.authorizeUrl.trim() &&
            oauth.tokenUrl.trim()
        ),
        contactClaim: oauth.contactClaim,
        enabled: oauth.enabled,
        label: oauth.label,
        provider,
        scopes: oauth.scopes,
        tokenUrl: oauth.tokenUrl,
        userInfoUrl: oauth.userInfoUrl
      };
    }),
    wechat: {
      appId: settings.wechat.appId,
      defaultAccount: settings.wechat.defaultAccount,
      defaultContact: settings.wechat.defaultContact,
      enabled: settings.wechat.enabled,
      mode: settings.wechat.mode,
      qrHint: settings.wechat.qrHint,
      qrTitle: settings.wechat.qrTitle
    }
  };
}

export function toAdminLoginSettings(
  settings: LoginSettings
): AdminLoginSettings {
  return {
    oauth: Object.fromEntries(
      oauthProviderIds.map((provider) => {
        const oauth = settings.oauth[provider];
        const { clientSecret, ...safeOauth } = oauth;

        return [
          provider,
          {
            ...safeOauth,
            clientSecretConfigured: Boolean(clientSecret.trim())
          }
        ];
      })
    ) as AdminLoginSettings["oauth"],
    wechat: (({ appSecret, ...safeWechat }) => ({
      ...safeWechat,
      appSecretConfigured: Boolean(appSecret.trim())
    }))(settings.wechat)
  };
}

export async function getLoginSettings() {
  return readDatabase(async (db) => {
    const row = await getFirstRow<LoginSettingsRow>(
      db,
      `SELECT json, updated_at
       FROM login_settings
       WHERE \`key\` = ?
       LIMIT 1`,
      [LOGIN_SETTINGS_KEY]
    );

    if (!row) {
      return defaultLoginSettings;
    }

    try {
      return normalizeLoginSettings(JSON.parse(row.json));
    } catch {
      return defaultLoginSettings;
    }
  });
}

export async function getPublicLoginSettings() {
  return toPublicLoginSettings(await getLoginSettings());
}

export async function saveLoginSettings(input: unknown) {
  const current = await getLoginSettings();
  const inputOAuth = isObject(input) && isObject(input.oauth) ? input.oauth : {};
  const inputWechat =
    isObject(input) && isObject(input.wechat) ? input.wechat : {};
  const oauthInputWithPreservedSecrets = Object.fromEntries(
    oauthProviderIds.map((provider) => {
      const providerInput = isObject(inputOAuth[provider])
        ? inputOAuth[provider]
        : {};
      const candidate =
        typeof providerInput.clientSecret === "string"
          ? providerInput.clientSecret.trim()
          : "";

      return [
        provider,
        {
          ...providerInput,
          clientSecret: candidate || current.oauth[provider].clientSecret
        }
      ];
    })
  );
  const appSecretCandidate =
    typeof inputWechat.appSecret === "string"
      ? inputWechat.appSecret.trim()
      : "";
  const next = normalizeLoginSettings({
    ...current,
    ...(isObject(input) ? input : {}),
    oauth: {
      apple: {
        ...current.oauth.apple,
        ...oauthInputWithPreservedSecrets.apple
      },
      github: {
        ...current.oauth.github,
        ...oauthInputWithPreservedSecrets.github
      },
      google: {
        ...current.oauth.google,
        ...oauthInputWithPreservedSecrets.google
      }
    },
    wechat: {
      ...current.wechat,
      ...inputWechat,
      appSecret: appSecretCandidate || current.wechat.appSecret
    }
  });
  const updatedAt = new Date().toISOString();

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO login_settings (\`key\`, json, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE json = VALUES(json), updated_at = VALUES(updated_at)`,
      [LOGIN_SETTINGS_KEY, JSON.stringify(next), updatedAt]
    );
  });

  return next;
}
