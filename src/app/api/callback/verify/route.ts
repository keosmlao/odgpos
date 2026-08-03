import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runQuery } from "@/lib/db";

let callbackTableEnsured = false;
async function persistCallback(payload: Buffer, signature: string, verified: boolean) {
  if (!callbackTableEnsured) {
    await runQuery(
      `CREATE TABLE IF NOT EXISTS pos_payment_callbacks (
        id SERIAL PRIMARY KEY, payload TEXT NOT NULL, signature TEXT,
        verified BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW()
      )`, [], "none"
    );
    callbackTableEnsured = true;
  }
  await runQuery(
    "INSERT INTO pos_payment_callbacks (payload, signature, verified) VALUES ($1, $2, $3)",
    [payload.toString("utf8"), signature, verified],
    "none"
  );
}

const CALLBACK_PUBLIC_KEY_HEX = "30820122300D06092A864886F70D01010105000382010F003082010A0282010100BB8E71F82ACF2D48010D9E728D9B9512E8D6F024E4CE305462B8D652345A044A59A587590E9BEAC3AE40BC5B0FC5B078E4C9C3B10514D81A2DE37B32590F3CDB4EE7852296D177FF9BB3473E611FD219B96180B77804542C7D569A320FAD9B8EA84A5D5AB8A058693428A35E7E45FBBAAB419B0133B16A8D5FC1989B7FADB5D65D336A94C5FCAC3E29E8AEB71C9037AB154E8A727328A6A02E15499EFD91291D960AC3C22AAF7E8FEC82553CE4547E18304F910D12182B793B00FAC6D322956E75BE921860B0CFD76817DE6B267D5BE75734F9F468573FA20D6869DD821C103EC4F45B14A70F2248194F1E4D6FB736BB58B92F15321D91C2F82867AC06C3C1D70203010001";

export async function POST(request: NextRequest) {
  const payload = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("Signature") || "";
  if (!payload.length || !signature) {
    return NextResponse.json({ status: "1", message: "Signature or data is missing" });
  }
  try {
    const publicKeyDer = Buffer.from(CALLBACK_PUBLIC_KEY_HEX, "hex");
    const publicKey = crypto.createPublicKey({ key: publicKeyDer, format: "der", type: "spki" });
    const signatureBuf = Buffer.from(signature, "hex");
    const ok = crypto.verify("sha256", payload, { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, signatureBuf);
    // Persist every callback so payment notifications are never silently dropped.
    await persistCallback(payload, signature, ok).catch((exc) =>
      console.error("callback/verify: failed to persist callback:", exc)
    );
    if (ok) return NextResponse.json({ status: "0", message: "transaction saved." });
    return NextResponse.json({ status: "1", message: "Signature is invalid" });
  } catch {
    return NextResponse.json({ status: "1", message: "Error verifying signature" }, { status: 500 });
  }
}
