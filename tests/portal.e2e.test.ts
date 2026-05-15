/**
 * @vitest-environment jsdom
 *
 * End-to-end test for the Client Portal store:
 *   - seed demo clients
 *   - upload a document
 *   - request a signature
 *   - record a signature and verify the SHA-256 integrity hash
 */
import { describe, it, expect, beforeEach } from "vitest";
import { portal } from "../src/lib/portal";
import { checkLockout, recordFailure, clearLockout } from "../src/lib/security";

// ipify lookup in recordSignature is best-effort and wrapped in try/catch;
// stub fetch so jsdom doesn't try a real network call.
globalThis.fetch = (async () => ({
  ok: true,
  json: async () => ({ ip: "203.0.113.7" }),
})) as unknown as typeof fetch;

beforeEach(() => {
  localStorage.clear();
});

describe("Client Portal e2e", () => {
  it("seeds clients, uploads a doc, and verifies signature hash", async () => {
    // 1. invite two demo clients
    const a = portal.invite("Demo Client A", "demo-a@example.com");
    const b = portal.invite("Demo Client B", "demo-b@example.com");
    expect(portal.list()).toHaveLength(2);
    expect(portal.byEmail("demo-a@example.com")?.id).toBe(a.id);
    expect(a.token).toMatch(/^[a-z0-9]{32}$/);

    // 2. upload a document for client A
    portal.addDocument(a.id, {
      name: "agreement.pdf",
      size: 1234,
      type: "application/pdf",
      dataUrl: "data:application/pdf;base64,QUJD",
      uploadedBy: "client",
      kind: "upload",
    });
    const aWithDoc = portal.get(a.id)!;
    expect(aWithDoc.documents).toHaveLength(1);
    expect(aWithDoc.documents[0].name).toBe("agreement.pdf");

    // 3. request a signature on a published agreement
    portal.requestSignature(b.id, "engagement-letter.pdf", "I agree to the terms.");
    const reqClient = portal.get(b.id)!;
    expect(reqClient.signatures).toHaveLength(1);
    const sig = reqClient.signatures[0];
    expect(sig.signedAt).toBeUndefined();

    // 4. record the signature and verify the integrity hash
    const signaturePng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    await portal.recordSignature(b.id, sig.id, {
      signerName: "Jane Doe",
      signatureDataUrl: signaturePng,
    });

    const signedClient = portal.get(b.id)!;
    const signed = signedClient.signatures[0];
    expect(signed.signedAt).toBeTypeOf("number");
    expect(signed.signerName).toBe("Jane Doe");
    expect(signed.signatureDataUrl).toBe(signaturePng);
    expect(signed.signerHash).toMatch(/^[0-9a-f]{64}$/);

    // recompute the expected hash and verify it matches
    const data = `${signed.signerName}|${signed.body}|${signed.signatureDataUrl}|${signed.signedAt}`;
    const buf = new TextEncoder().encode(data);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    const expected = Array.from(new Uint8Array(hashBuf))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    expect(signed.signerHash).toBe(expected);

    // already-signed requests are immutable
    await portal.recordSignature(b.id, sig.id, {
      signerName: "Someone Else",
      signatureDataUrl: signaturePng,
    });
    expect(portal.get(b.id)!.signatures[0].signerName).toBe("Jane Doe");
  });

  it("locks out portal token guessing after repeated failures", () => {
    const bucket = "portal:test-token";
    const opts = { maxAttempts: 3, windowMs: 60_000, lockoutMs: 60_000 };

    expect(checkLockout(bucket).allowed).toBe(true);
    const r1 = recordFailure(bucket, opts);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    recordFailure(bucket, opts);
    const r3 = recordFailure(bucket, opts);
    expect(r3.allowed).toBe(false);
    expect(r3.retryAfterMs).toBeGreaterThan(0);

    // subsequent checks remain locked
    expect(checkLockout(bucket).allowed).toBe(false);

    clearLockout(bucket);
    expect(checkLockout(bucket).allowed).toBe(true);
  });
});
