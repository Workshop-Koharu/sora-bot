import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from "discord.js";
import QRCode from "qrcode";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const utilityCommands = [
  // /도구 [계산기 | 단위변환 | 진법변환 | 날씨 | 환율 | qr | 시간변환]
  {
    data: new SlashCommandBuilder()
      .setName("도구")
      .setDescription("다양한 편의 유틸리티 도구 모음")
      .addSubcommand((sub) =>
        sub
          .setName("계산기")
          .setDescription("수식을 계산합니다 (사칙연산, 괄호, 제곱 지원).")
          .addStringOption((opt) => opt.setName("수식").setDescription("계산할 수식 (예: (10 + 20) * 3)").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("단위변환")
          .setDescription("길이, 무게, 온도, 속도 단위를 즉시 환산합니다.")
          .addNumberOption((opt) => opt.setName("값").setDescription("변환할 수치").setRequired(true))
          .addStringOption((opt) =>
            opt
              .setName("종류")
              .setDescription("변환 유형")
              .setRequired(true)
              .addChoices(
                { name: "길이 (km ➡️ mile)", value: "km_to_mile" },
                { name: "길이 (mile ➡️ km)", value: "mile_to_km" },
                { name: "길이 (cm ➡️ inch)", value: "cm_to_inch" },
                { name: "길이 (inch ➡️ cm)", value: "inch_to_cm" },
                { name: "무게 (kg ➡️ lb)", value: "kg_to_lb" },
                { name: "무게 (lb ➡️ kg)", value: "lb_to_kg" },
                { name: "온도 (℃ ➡️ ℉)", value: "c_to_f" },
                { name: "온도 (℉ ➡️ ℃)", value: "f_to_c" }
              )
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("진법변환")
          .setDescription("2진수, 8진수, 10진수, 16진수 상호 변환을 수행합니다.")
          .addStringOption((opt) => opt.setName("숫자").setDescription("변환할 값").setRequired(true))
          .addIntegerOption((opt) =>
            opt
              .setName("입력진법")
              .setDescription("입력한 숫자의 진법")
              .setRequired(true)
              .addChoices(
                { name: "2진수 (Binary)", value: 2 },
                { name: "8진수 (Octal)", value: 8 },
                { name: "10진수 (Decimal)", value: 10 },
                { name: "16진수 (Hexadecimal)", value: 16 }
              )
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("날씨")
          .setDescription("도시를 입력하여 현재 기상 상태를 조회합니다.")
          .addStringOption((opt) => opt.setName("도시").setDescription("도시명 (예: 서울, 부산, 도쿄, 뉴욕)").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("환율")
          .setDescription("최신 실시간 환율을 조회합니다.")
          .addStringOption((opt) =>
            opt
              .setName("기준통화")
              .setDescription("기준 통화 (기본: USD)")
              .addChoices(
                { name: "USD (미국 달러)", value: "USD" },
                { name: "JPY (일본 엔)", value: "JPY" },
                { name: "EUR (유럽 유로)", value: "EUR" }
              )
          )
          .addNumberOption((opt) => opt.setName("금액").setDescription("환산할 금액 (기본: 1)"))
      )
      .addSubcommand((sub) =>
        sub
          .setName("qr")
          .setDescription("텍스트나 웹 링크를 QR 코드로 생성합니다.")
          .addStringOption((opt) => opt.setName("내용").setDescription("QR 코드로 인코딩할 텍스트나 URL").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("시간변환")
          .setDescription("세계 주요 도시의 현재 시간을 비교합니다.")
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "계산기") {
        const expr = interaction.options.getString("수식", true);
        const sanitized = expr.replace(/\^/g, "**").replace(/[^0-9+\-*/().%*]/g, "");

        try {
          const fn = new Function(`return (${sanitized})`);
          const result = fn();

          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# 🔢 계산기 결과\n• **입력 수식:** \`${expr}\`\n• **계산 결과:** **${result}**`
              ),
            ],
            0x5865f2
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container));
        } catch {
          await interaction.reply({ content: "유효하지 않은 수식입니다. 연산자와 괄호를 확인해 주세요.", ephemeral: true });
        }
        return;
      }

      if (subcommand === "단위변환") {
        const val = interaction.options.getNumber("값", true);
        const type = interaction.options.getString("종류", true);

        let converted = 0;
        let fromUnit = "";
        let toUnit = "";

        switch (type) {
          case "km_to_mile":
            converted = val * 0.621371;
            fromUnit = "km";
            toUnit = "mile";
            break;
          case "mile_to_km":
            converted = val / 0.621371;
            fromUnit = "mile";
            toUnit = "km";
            break;
          case "cm_to_inch":
            converted = val * 0.393701;
            fromUnit = "cm";
            toUnit = "inch";
            break;
          case "inch_to_cm":
            converted = val / 0.393701;
            fromUnit = "inch";
            toUnit = "cm";
            break;
          case "kg_to_lb":
            converted = val * 2.20462;
            fromUnit = "kg";
            toUnit = "lb";
            break;
          case "lb_to_kg":
            converted = val / 2.20462;
            fromUnit = "lb";
            toUnit = "kg";
            break;
          case "c_to_f":
            converted = (val * 9) / 5 + 32;
            fromUnit = "℃";
            toUnit = "℉";
            break;
          case "f_to_c":
            converted = ((val - 32) * 5) / 9;
            fromUnit = "℉";
            toUnit = "℃";
            break;
        }

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 📐 단위 변환 결과\n**${val} ${fromUnit}** = **${converted.toFixed(2)} ${toUnit}**`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }

      if (subcommand === "진법변환") {
        const inputStr = interaction.options.getString("숫자", true).trim();
        const base = interaction.options.getInteger("입력진법", true);

        try {
          const num = parseInt(inputStr, base);
          if (isNaN(num)) throw new Error("변환 불가");

          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# 🔢 진법 변환 결과: \`${inputStr}\` (${base}진수)\n\n• **2진수:** \`${num.toString(2)}\`\n• **8진수:** \`${num.toString(8)}\`\n• **10진수:** \`${num.toString(10)}\`\n• **16진수:** \`0x${num.toString(16).toUpperCase()}\``
              ),
            ],
            0x5865f2
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container));
        } catch {
          await interaction.reply({ content: `'${inputStr}'는 유효한 ${base}진수가 아닙니다.`, ephemeral: true });
        }
        return;
      }

      if (subcommand === "날씨") {
        const city = interaction.options.getString("도시", true);

        try {
          const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
          if (!res.ok) throw new Error("조회 실패");
          const data = (await res.json()) as any;
          const current = data.current_condition[0];

          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# 🌤️ ${city} 날씨 정보\n• **상태:** ${current.weatherDesc[0].value}\n• **기온:** ${current.temp_C}℃ (체감: ${current.FeelsLikeC}℃)\n• **습도:** ${current.humidity}%\n• **풍속:** ${current.windspeedKmph} km/h`
              ),
            ],
            0x5865f2
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container));
        } catch {
          await interaction.reply({ content: `'${city}'의 날씨 정보를 조회하지 못했습니다.`, ephemeral: true });
        }
        return;
      }

      if (subcommand === "환율") {
        const base = interaction.options.getString("기준통화") || "USD";
        const amount = interaction.options.getNumber("금액") || 1;

        try {
          const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
          const data = (await res.json()) as any;
          const krwRate = data.rates["KRW"];
          const totalKrw = amount * krwRate;

          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# 💱 최신 환율 정보\n**1 ${base}** = **${krwRate.toLocaleString()} KRW**\n\n• **환산 금액:** ${amount.toLocaleString()} ${base} = **${totalKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })} KRW**`
              ),
            ],
            0x5865f2
          );
          await interaction.reply(ComponentsV2Builder.formatMessage(container));
        } catch {
          await interaction.reply({ content: "환율 정보를 불러오는 중 오류가 발생했습니다.", ephemeral: true });
        }
        return;
      }

      if (subcommand === "qr") {
        const text = interaction.options.getString("내용", true);

        try {
          const buffer = await QRCode.toBuffer(text, { width: 350, margin: 2 });
          const attachment = new AttachmentBuilder(buffer, { name: "qrcode.png" });

          const container = ComponentsV2Builder.container(
            [
              ComponentsV2Builder.text(
                `# 📱 QR 코드 생성 완료\n• **내용:** \`${text}\``
              ),
            ],
            0x5865f2
          );

          await interaction.reply({
            ...ComponentsV2Builder.formatMessage(container),
            files: [attachment],
          });
        } catch {
          await interaction.reply({ content: "QR 코드 생성에 실패했습니다.", ephemeral: true });
        }
        return;
      }

      if (subcommand === "시간변환") {
        const now = new Date();
        const kst = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
        const jst = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
        const utc = now.toLocaleString("en-US", { timeZone: "UTC" });
        const gmt = now.toLocaleString("en-GB", { timeZone: "Europe/London" });
        const est = now.toLocaleString("en-US", { timeZone: "America/New_York" });
        const pst = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🌍 세계 주요 도시 현재 시각\n• **서울/도쿄 (KST/JST, UTC+9):** ${kst}\n• **런던 (GMT, UTC+0):** ${gmt}\n• **뉴욕 (EST, UTC-5):** ${est}\n• **로스앤젤레스 (PST, UTC-8):** ${pst}\n• **표준시 (UTC):** ${utc}`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
        return;
      }
    },
  },
];
