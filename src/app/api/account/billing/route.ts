import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import {
  createLingqiongPayment,
  getLingqiongBilling,
  LingqiongAccountError,
  quoteLingqiongTopup,
  redeemLingqiongCode
} from "@/lib/lingqiong-account";

export const runtime = "nodejs";

function billingError(error: unknown) {
  if (error instanceof LingqiongAccountError) {
    return NextResponse.json(
      {
        error: { code: error.code, message: error.message },
        message: error.message,
        ok: false,
        rechargeUrl: error.rechargeUrl
      },
      { status: error.status }
    );
  }

  console.error("Account billing request failed", error);
  return NextResponse.json(
    { message: "充值支付服务暂时不可用，请稍后重试。", ok: false },
    { status: 500 }
  );
}

export async function GET() {
  const auth = await requirePlatformUser();

  if (auth.response) {
    return auth.response;
  }

  try {
    return NextResponse.json({
      ...(await getLingqiongBilling(auth.session)),
      ok: true
    });
  } catch (error) {
    return billingError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformUser();

  if (auth.response) {
    return auth.response;
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > 16 * 1024) {
    return NextResponse.json(
      { message: "支付请求内容过大。", ok: false },
      { status: 413 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        amount?: unknown;
        code?: unknown;
        paymentMethod?: unknown;
      }
    | null;

  if (!body) {
    return NextResponse.json(
      { message: "支付请求格式不正确。", ok: false },
      { status: 400 }
    );
  }

  try {
    if (body.action === "quote") {
      return NextResponse.json({
        data: await quoteLingqiongTopup(auth.session, {
          amount: body.amount,
          paymentMethod: body.paymentMethod
        }),
        ok: true
      });
    }

    if (body.action === "pay") {
      return NextResponse.json({
        data: await createLingqiongPayment(auth.session, {
          amount: body.amount,
          paymentMethod: body.paymentMethod
        }),
        ok: true
      });
    }

    if (body.action === "redeem") {
      return NextResponse.json({
        data: await redeemLingqiongCode(auth.session, body.code),
        ok: true
      });
    }

    return NextResponse.json(
      { message: "不支持的支付操作。", ok: false },
      { status: 400 }
    );
  } catch (error) {
    return billingError(error);
  }
}
