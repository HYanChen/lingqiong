export const PLATFORM_API_VERSION = "v1" as const;

export type PlatformApiMeta = {
  generatedAt: string;
  version: typeof PLATFORM_API_VERSION;
};

export type PlatformApiSuccess<T> = {
  data: T;
  meta: PlatformApiMeta;
  ok: true;
};

export type PlatformApiFailure = {
  error: {
    code: string;
    message: string;
  };
  meta: PlatformApiMeta;
  ok: false;
};

export type PlatformApiResponse<T> = PlatformApiSuccess<T> | PlatformApiFailure;

function responseMeta(): PlatformApiMeta {
  return {
    generatedAt: new Date().toISOString(),
    version: PLATFORM_API_VERSION
  };
}

export function platformApiSuccess<T>(data: T): PlatformApiSuccess<T> {
  return {
    data,
    meta: responseMeta(),
    ok: true
  };
}

export function platformApiFailure(
  code: string,
  message: string
): PlatformApiFailure {
  return {
    error: { code, message },
    meta: responseMeta(),
    ok: false
  };
}
