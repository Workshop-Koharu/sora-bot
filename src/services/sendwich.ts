import crypto from "node:crypto";

export interface SendwichCreateResponse {
  id: string;
  status: "pending" | "verified" | "expired" | "cancelled";
  destination: string;
  sms_text: string;
  verification_url?: string;
  expires_at: string;
  mode: string;
}

export interface SendwichRetrieveResponse {
  id: string;
  status: "pending" | "verified" | "expired" | "cancelled";
  phone?: string | null;
  carrier?: string | null;
  verified_at?: string | null;
  expires_at: string;
}

export class SendwichService {
  private static API_BASE = "https://api.sendwich.kr";

  private static getApiKey(): string {
    const key = process.env.SENDWICH_API_KEY;
    if (!key) {
      throw new Error("SENDWICH_API_KEY가 설정되지 않았습니다.");
    }
    return key;
  }

  /**
   * Create a new phone verification attempt using Sendwich discover mode (Free plan compatible)
   */
  public static async createVerification(
    clientReference: string
  ): Promise<SendwichCreateResponse> {
    const apiKey = this.getApiKey();
    const state = crypto.randomBytes(16).toString("hex");
    const idempotencyKey = `sora_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

    const res = await fetch(`${this.API_BASE}/v1/verifications`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        mode: "discover",
        client_reference: clientReference.slice(0, 160),
        state,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sendwich API 오류 (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as SendwichCreateResponse;
    return data;
  }

  /**
   * Retrieve verification status and result
   */
  public static async getVerification(
    verificationId: string
  ): Promise<SendwichRetrieveResponse> {
    const apiKey = this.getApiKey();

    const res = await fetch(`${this.API_BASE}/v1/verifications/${verificationId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sendwich 조회 오류 (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as SendwichRetrieveResponse;
    return data;
  }

  /**
   * Cancel pending verification
   */
  public static async cancelVerification(
    verificationId: string
  ): Promise<SendwichRetrieveResponse> {
    const apiKey = this.getApiKey();

    const res = await fetch(`${this.API_BASE}/v1/verifications/${verificationId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sendwich 취소 오류 (${res.status}): ${errorText}`);
    }

    return (await res.json()) as SendwichRetrieveResponse;
  }
}
