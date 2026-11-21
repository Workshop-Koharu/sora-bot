import { Resend } from "resend";

export class ResendService {
  private static client: Resend | null = null;

  private static getClient(): Resend {
    if (!this.client) {
      const key = process.env.RESEND_API_KEY;
      if (!key) {
        throw new Error("RESEND_API_KEY가 설정되지 않았습니다.");
      }
      this.client = new Resend(key);
    }
    return this.client;
  }

  public static async sendVerificationCode(
    recipientEmail: string,
    code: string,
    guildName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const resend = this.getClient();
      const sender = process.env.RESEND_SENDER_EMAIL || "admin@koharu.live";

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">${guildName} 디스코드 이메일 인증</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            안녕하세요! 디스코드 서버 <strong>${guildName}</strong> 회원 인증을 위한 6자리 인증 코드입니다.
          </p>
          <div style="margin: 24px 0; padding: 18px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; text-align: center;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #2563eb; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            * 이 코드는 5분간 유효합니다.<br>
            * 본인이 요청하지 않은 경우 이 메일을 무시해 주세요.
          </p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Sora Bot • Koharu Coding Server (KCS)
          </p>
        </div>
      `;

      await resend.emails.send({
        from: `Sora Verification <${sender}>`,
        to: recipientEmail,
        subject: `[${guildName}] 디스코드 이메일 인증 코드: ${code}`,
        html: htmlContent,
      });

      return { success: true };
    } catch (err: any) {
      console.error("Resend email send error:", err);
      return { success: false, error: err?.message || "이메일 전송 실패" };
    }
  }
}
