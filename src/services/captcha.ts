import crypto from "node:crypto";

export interface CaptchaChallenge {
  code: string;
  asciiArt: string;
  svgDataUri: string;
}

export class CaptchaService {
  private static CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  public static generate(length = 6): CaptchaChallenge {
    let code = "";
    for (let i = 0; i < length; i++) {
      const idx = crypto.randomInt(0, this.CHARS.length);
      code += this.CHARS[idx];
    }

    // Generate high contrast visual SVG data URI for Component V2 Media
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="90" viewBox="0 0 300 90">
        <rect width="300" height="90" fill="#1e1f22" rx="8" />
        <!-- Noise background lines -->
        <path d="M 10 20 Q 80 80 150 20 T 290 70" fill="none" stroke="#4e5058" stroke-width="2" opacity="0.6"/>
        <path d="M 20 80 Q 90 10 160 80 T 280 20" fill="none" stroke="#5865f2" stroke-width="2" opacity="0.4"/>
        <path d="M 5 50 Q 100 20 200 60 T 295 40" fill="none" stroke="#3ba55c" stroke-width="1.5" opacity="0.5"/>
        <!-- Distorted letters -->
        ${code
          .split("")
          .map((ch, idx) => {
            const x = 35 + idx * 40;
            const y = 55 + (idx % 2 === 0 ? -4 : 6);
            const rot = (idx % 2 === 0 ? -12 : 12) + (idx * 3);
            return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#f2f3f5" transform="rotate(${rot}, ${x}, ${y})">${ch}</text>`;
          })
          .join("\n")}
      </svg>
    `.trim();

    const svgBase64 = Buffer.from(svg).toString("base64");
    const svgDataUri = `data:image/svg+xml;base64,${svgBase64}`;

    // Plain readable monospace layout for text display fallback
    const asciiArt = `\`\`\`\n[ ${code.split("").join(" ")} ]\n\`\`\``;

    return {
      code,
      asciiArt,
      svgDataUri,
    };
  }
}
