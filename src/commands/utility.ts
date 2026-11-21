import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from "discord.js";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { Jimp } from "jimp";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const utilityCommands = [
  // 40. /계산기
  {
    data: new SlashCommandBuilder()
      .setName("계산기")
      .setDescription("괄호, 사칙연산, 백분율(%), 거듭제곱을 지원하는 수식 계산기")
      .addStringOption((opt) => opt.setName("수식").setDescription("계산할 수식 (예: (15 + 25) * 4 / 2)").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      const expr = interaction.options.getString("수식", true);
      // Clean and sanitize expression: allow digits, +, -, *, /, %, (, ), ., ^
      const sanitized = expr.replace(/\^/g, "**").replace(/[^0-9+\-*/().%*]/g, "");

      try {
        // Safe evaluation
        const fn = new Function(`return (${sanitized})`);
        const result = fn();

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.KCS} 계산기 결과\n• **입력 수식:** \`${expr}\`\n• **연산 결과:** \`${result}\``
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
      } catch {
        await interaction.reply({ content: "유효하지 않은 수식입니다. 연산자와 괄호를 확인해 주세요.", ephemeral: true });
      }
    },
  },

  // 41. /단위변환
  {
    data: new SlashCommandBuilder()
      .setName("단위변환")
      .setDescription("길이, 무게, 온도, 부피, 속도 단위를 즉시 변환합니다.")
      .addNumberOption((opt) => opt.setName("값").setDescription("변환할 수치").setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName("종류")
          .setDescription("단위 유형")
          .setRequired(true)
          .addChoices(
            { name: "길이 (km ➡️ mile)", value: "km_to_mile" },
            { name: "길이 (mile ➡️ km)", value: "mile_to_km" },
            { name: "길이 (cm ➡️ inch)", value: "cm_to_inch" },
            { name: "길이 (inch ➡️ cm)", value: "inch_to_cm" },
            { name: "무게 (kg ➡️ lb)", value: "kg_to_lb" },
            { name: "무게 (lb ➡️ kg)", value: "lb_to_kg" },
            { name: "온도 (℃ ➡️ ℉)", value: "c_to_f" },
            { name: "온도 (℉ ➡️ ℃)", value: "f_to_c" },
            { name: "속도 (km/h ➡️ mph)", value: "kmh_to_mph" }
          )
      ),

    async execute(interaction: ChatInputCommandInteraction) {
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
        case "kmh_to_mph":
          converted = val * 0.621371;
          fromUnit = "km/h";
          toUnit = "mph";
          break;
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 단위 변환 결과\n**${val} ${fromUnit}** = **${converted.toFixed(2)} ${toUnit}**`
          ),
        ],
        0x5865f2
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 42. /진법변환
  {
    data: new SlashCommandBuilder()
      .setName("진법변환")
      .setDescription("2진수, 8진수, 10진수, 16진수 간 상호 변환을 수행합니다.")
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
      ),

    async execute(interaction: ChatInputCommandInteraction) {
      const inputStr = interaction.options.getString("숫자", true).trim();
      const base = interaction.options.getInteger("입력진법", true);

      try {
        const num = parseInt(inputStr, base);
        if (isNaN(num)) throw new Error("변환 불가");

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.KCS} 진법 변환 결과: \`${inputStr}\` (${base}진수)\n\n• **2진수:** \`${num.toString(2)}\`\n• **8진수:** \`${num.toString(8)}\`\n• **10진수:** \`${num.toString(10)}\`\n• **16진수:** \`0x${num.toString(16).toUpperCase()}\``
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
      } catch {
        await interaction.reply({ content: `입력값 '${inputStr}'는 유효한 ${base}진수가 아닙니다.`, ephemeral: true });
      }
    },
  },

  // 43. /날짜계산
  {
    data: new SlashCommandBuilder()
      .setName("날짜계산")
      .setDescription("두 날짜 사이의 일수 계산 또는 지정 날짜 기준 더하기/빼기")
      .addStringOption((opt) => opt.setName("기준날짜").setDescription("YYYY-MM-DD 형식").setRequired(true))
      .addStringOption((opt) => opt.setName("대상날짜").setDescription("두 날짜 간격 계산 시 (YYYY-MM-DD)"))
      .addIntegerOption((opt) => opt.setName("일수더하기").setDescription("더하거나 뺄 일수(음수 가능)")),

    async execute(interaction: ChatInputCommandInteraction) {
      const baseStr = interaction.options.getString("기준날짜", true);
      const targetStr = interaction.options.getString("대상날짜");
      const addDays = interaction.options.getInteger("일수더하기");

      const baseDate = new Date(baseStr);
      if (isNaN(baseDate.getTime())) {
        await interaction.reply({ content: "기준 날짜 형식이 잘못되었습니다. (예: 2026-11-20)", ephemeral: true });
        return;
      }

      let resultText = "";
      if (targetStr) {
        const targetDate = new Date(targetStr);
        if (isNaN(targetDate.getTime())) {
          await interaction.reply({ content: "대상 날짜 형식이 잘못되었습니다.", ephemeral: true });
          return;
        }
        const diffMs = targetDate.getTime() - baseDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        resultText = `• 두 날짜의 차이: **${Math.abs(diffDays)}일** (${diffDays >= 0 ? "이후" : "이전"})`;
      } else if (addDays !== null) {
        const calcDate = new Date(baseDate);
        calcDate.setDate(calcDate.getDate() + addDays);
        resultText = `• ${addDays >= 0 ? `+${addDays}` : addDays}일 후 날짜: **${calcDate.toISOString().slice(0, 10)}**`;
      } else {
        resultText = "• 대상 날짜 또는 더할 일수를 입력해 주세요.";
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 날짜 계산 결과\n**기준일:** ${baseStr}\n${resultText}`
          ),
        ],
        0x5865f2
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 44. /시간대변환
  {
    data: new SlashCommandBuilder()
      .setName("시간대변환")
      .setDescription("한국 시간(KST)을 세계 주요 시간대로 변환합니다.")
      .addStringOption((opt) => opt.setName("시각").setDescription("YYYY-MM-DD HH:mm (미입력 시 현재 시각)")),

    async execute(interaction: ChatInputCommandInteraction) {
      const input = interaction.options.getString("시각");
      const baseDate = input ? new Date(input) : new Date();

      if (isNaN(baseDate.getTime())) {
        await interaction.reply({ content: "시각 형식이 올바르지 않습니다.", ephemeral: true });
        return;
      }

      const kst = baseDate.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      const utc = baseDate.toLocaleString("en-US", { timeZone: "UTC" });
      const jst = baseDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      const est = baseDate.toLocaleString("en-US", { timeZone: "America/New_York" });
      const pst = baseDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
      const gmt = baseDate.toLocaleString("en-GB", { timeZone: "Europe/London" });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 전세계 시간대 변환표\n\n• **한국 (KST / UTC+9):** ${kst}\n• **일본 (JST / UTC+9):** ${jst}\n• **표준시 (UTC):** ${utc}\n• **영국 런던 (GMT):** ${gmt}\n• **미국 동부 (EST):** ${est}\n• **미국 서부 (PST):** ${pst}`
          ),
        ],
        0x5865f2
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 45. /타임스탬프변환
  {
    data: new SlashCommandBuilder()
      .setName("타임스탬프변환")
      .setDescription("Unix 타임스탬프와 날짜 상호 변환")
      .addStringOption((opt) => opt.setName("입력").setDescription("Unix 초 단위 숫자 또는 YYYY-MM-DD HH:mm")),

    async execute(interaction: ChatInputCommandInteraction) {
      const input = interaction.options.getString("입력") || Math.floor(Date.now() / 1000).toString();
      let ts = 0;

      if (/^\d+$/.test(input.trim())) {
        ts = parseInt(input.trim(), 10);
      } else {
        const d = new Date(input);
        if (isNaN(d.getTime())) {
          await interaction.reply({ content: "유효하지 않은 날짜/타임스탬프 형식입니다.", ephemeral: true });
          return;
        }
        ts = Math.floor(d.getTime() / 1000);
      }

      const dateStr = new Date(ts * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 타임스탬프 변환 결과\n• **Unix Timestamp:** \`${ts}\`\n• **KST 환산 시각:** ${dateStr}\n• **Discord 코드:** \`<t:${ts}:F>\` (상대적: \`<t:${ts}:R>\`)`
          ),
        ],
        0x5865f2
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 46. /초읽기
  {
    data: new SlashCommandBuilder()
      .setName("초읽기")
      .setDescription("개인 타이머를 설정하고 시간이 되면 알림을 받습니다.")
      .addIntegerOption((opt) => opt.setName("초").setDescription("타이머 시간 (초 단위)").setRequired(true).setMinValue(1).setMaxValue(3600))
      .addStringOption((opt) => opt.setName("메모").setDescription("타이머 메모")),

    async execute(interaction: ChatInputCommandInteraction) {
      const seconds = interaction.options.getInteger("초", true);
      const memo = interaction.options.getString("메모") || "지정한 시간이 완료되었습니다!";
      const targetUnix = Math.floor((Date.now() + seconds * 1000) / 1000);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.CHECK} 개인 타이머 시작 [${seconds}초]\n• **종료 예정 시각:** <t:${targetUnix}:T> (<t:${targetUnix}:R>)\n• **메모:** ${memo}\n\n시간이 지나면 멘션으로 알려드립니다!`
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));

      setTimeout(async () => {
        try {
          await interaction.followUp({
            content: `⏰ <@${interaction.user.id}> 님의 타이머가 종료되었습니다! [메모: ${memo}]`,
            ephemeral: true,
          });
        } catch {}
      }, seconds * 1000);
    },
  },

  // 47. /스톱워치
  {
    data: new SlashCommandBuilder()
      .setName("스톱워치")
      .setDescription("개인 스톱워치를 시작합니다."),

    async execute(interaction: ChatInputCommandInteraction) {
      const startTime = Date.now();
      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 개인 스톱워치\n**측정 시작:** <t:${Math.floor(startTime / 1000)}:T>\n스톱워치가 시작되었습니다.`
          ),
          ComponentsV2Builder.separator(true, 1),
          ComponentsV2Builder.actionRow(
            ComponentsV2Builder.button("랩(Lap) 기록", `stopwatch_lap_${startTime}`),
            ComponentsV2Builder.button("정지", `stopwatch_stop_${startTime}`)
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
    },
  },

  // 48. /D데이
  {
    data: new SlashCommandBuilder()
      .setName("d데이")
      .setDescription("목표 날짜까지 남은 일수와 경과 일수를 계산합니다.")
      .addStringOption((opt) => opt.setName("날짜").setDescription("YYYY-MM-DD 형식").setRequired(true))
      .addStringOption((opt) => opt.setName("이름").setDescription("일정 이름")),

    async execute(interaction: ChatInputCommandInteraction) {
      const dateStr = interaction.options.getString("날짜", true);
      const name = interaction.options.getString("이름") || "목표일";
      const targetDate = new Date(dateStr);

      if (isNaN(targetDate.getTime())) {
        await interaction.reply({ content: "올바른 날짜 형식이 아닙니다.", ephemeral: true });
        return;
      }

      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const dDayText = diffDays === 0 ? "D-Day (오늘!)" : diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} D-Day 계산: **${name}**\n• **목표 날짜:** ${dateStr}\n• **결과:** **${dDayText}**`
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 49. /확률계산
  {
    data: new SlashCommandBuilder()
      .setName("확률계산")
      .setDescription("독립 사건의 확률 및 조합(nCr), 순열(nPr) 계산")
      .addStringOption((opt) =>
        opt
          .setName("유형")
          .setDescription("계산 종류 선택")
          .setRequired(true)
          .addChoices(
            { name: "조합 (nCr)", value: "comb" },
            { name: "순열 (nPr)", value: "perm" },
            { name: "확률 (n회 시도 중 1회 이상 당첨)", value: "gacha" }
          )
      )
      .addNumberOption((opt) => opt.setName("n").setDescription("전체 개수 (n)").setRequired(true))
      .addNumberOption((opt) => opt.setName("r").setDescription("선택 개수 (r) 또는 당첨 확률(%)")),

    async execute(interaction: ChatInputCommandInteraction) {
      const type = interaction.options.getString("유형", true);
      const n = interaction.options.getNumber("n", true);
      const r = interaction.options.getNumber("r") || 1;

      const fact = (num: number): number => (num <= 1 ? 1 : num * fact(num - 1));

      let resultText = "";
      if (type === "comb") {
        if (r > n) {
          resultText = "r은 n보다 클 수 없습니다.";
        } else {
          const val = fact(n) / (fact(r) * fact(n - r));
          resultText = `**${n}C${r}** = **${val.toLocaleString()}**가지 경우의 수`;
        }
      } else if (type === "perm") {
        if (r > n) {
          resultText = "r은 n보다 클 수 없습니다.";
        } else {
          const val = fact(n) / fact(n - r);
          resultText = `**${n}P${r}** = **${val.toLocaleString()}**가지 경우의 수`;
        }
      } else {
        // gacha: n tries, r% rate
        const failRate = 1 - r / 100;
        const totalFail = Math.pow(failRate, n);
        const winRate = (1 - totalFail) * 100;
        resultText = `당첨 확률 ${r}%로 **${n}회** 시도 시 1회 이상 당첨 확률: **${winRate.toFixed(2)}%**`;
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 확률 및 경우의 수 연산\n\n${resultText}`
          ),
        ],
        0x5865f2
      );

      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 50. /날씨
  {
    data: new SlashCommandBuilder()
      .setName("날씨")
      .setDescription("도시를 지정해 현재 날씨와 단기 예보를 조회합니다.")
      .addStringOption((opt) => opt.setName("도시").setDescription("도시 이름 (예: 서울, 부산, 도쿄, 뉴욕)").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      const city = interaction.options.getString("도시", true);

      // Free wttr.in JSON API
      try {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
        if (!res.ok) throw new Error("날씨 정보 조회 실패");
        const data = (await res.json()) as any;
        const current = data.current_condition[0];
        const tempC = current.temp_C;
        const desc = current.weatherDesc[0].value;
        const humidity = current.humidity;
        const wind = current.windspeedKmph;

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# 🌤️ ${city} 현재 날씨 예보\n• **상태:** ${desc}\n• **기온:** ${tempC}℃ (체감: ${current.FeelsLikeC}℃)\n• **습도:** ${humidity}%\n• **풍속:** ${wind} km/h`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
      } catch {
        await interaction.reply({ content: `도시 '${city}'의 날씨 정보를 가져올 수 없습니다.`, ephemeral: true });
      }
    },
  },

  // 51. /환율
  {
    data: new SlashCommandBuilder()
      .setName("환율")
      .setDescription("최신 환율 및 환산 금액을 조회합니다.")
      .addStringOption((opt) => opt.setName("기준통화").setDescription("기준 통화 (기본: USD)").addChoices({ name: "USD (미국 달러)", value: "USD" }, { name: "JPY (일본 엔)", value: "JPY" }, { name: "EUR (유로)", value: "EUR" }))
      .addNumberOption((opt) => opt.setName("금액").setDescription("환산할 금액")),

    async execute(interaction: ChatInputCommandInteraction) {
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
              `# 💱 최신 환율 정보\n**기준:** 1 ${base} = **${krwRate.toLocaleString()} KRW**\n\n• **환산 금액:** ${amount.toLocaleString()} ${base} = **${totalKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })} KRW**`
            ),
          ],
          0x5865f2
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
      } catch {
        await interaction.reply({ content: "환율 정보를 불러오는 중 오류가 발생했습니다.", ephemeral: true });
      }
    },
  },

  // 52. /QR생성
  {
    data: new SlashCommandBuilder()
      .setName("qr생성")
      .setDescription("텍스트나 링크를 QR 코드 이미지로 생성합니다.")
      .addStringOption((opt) => opt.setName("내용").setDescription("QR 코드로 만들 텍스트나 URL").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      const text = interaction.options.getString("내용", true);

      try {
        const buffer = await QRCode.toBuffer(text, { width: 350, margin: 2 });
        const attachment = new AttachmentBuilder(buffer, { name: "qrcode.png" });

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.KCS} QR 코드 생성 완료\n**입력 내용:** \`${text}\``
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
    },
  },

  // 53. /QR읽기
  {
    data: new SlashCommandBuilder()
      .setName("qr읽기")
      .setDescription("첨부한 이미지에서 QR 코드 내용을 추출하여 표시합니다.")
      .addAttachmentOption((opt) => opt.setName("이미지").setDescription("QR 코드가 포함된 이미지").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      const attachment = interaction.options.getAttachment("이미지", true);

      try {
        const response = await fetch(attachment.url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const image = await Jimp.read(buffer);
        const qr = jsQR(new Uint8ClampedArray(image.bitmap.data), image.bitmap.width, image.bitmap.height);

        if (!qr) {
          await interaction.reply({ content: "이미지에서 유효한 QR 코드를 감지하지 못했습니다.", ephemeral: true });
          return;
        }

        const container = ComponentsV2Builder.container(
          [
            ComponentsV2Builder.text(
              `# ${EMOJI_STRINGS.CHECK} QR 코드 판독 성공\n• **해석된 내용:**\n\`\`\`\n${qr.data}\n\`\`\``
            ),
          ],
          0x57f287
        );
        await interaction.reply(ComponentsV2Builder.formatMessage(container));
      } catch (err: any) {
        await interaction.reply({ content: `QR 읽기 오류: ${err.message}`, ephemeral: true });
      }
    },
  },

  // 54. /파일정보
  {
    data: new SlashCommandBuilder()
      .setName("파일정보")
      .setDescription("첨부 파일의 이름, 확장자, 용량, MIME 유형을 분석합니다.")
      .addAttachmentOption((opt) => opt.setName("파일").setDescription("분석할 첨부 파일").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      const file = interaction.options.getAttachment("파일", true);
      const ext = file.name.split(".").pop()?.toUpperCase() || "알 수 없음";
      const sizeKb = (file.size / 1024).toFixed(1);
      const sizeMb = (file.size / 1024 / 1024).toFixed(2);

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 파일 메타데이터 분석\n• **파일명:** \`${file.name}\`\n• **확장자:** \`.${ext}\`\n• **MIME 유형:** \`${file.contentType || "미지정"}\`\n• **용량:** ${sizeKb} KB (${sizeMb} MB)\n• **파일 다운로드:** [클릭](${file.url})`
          ),
        ],
        0x5865f2
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },

  // 55. /이미지정보
  {
    data: new SlashCommandBuilder()
      .setName("이미지정보")
      .setDescription("이미지의 해상도(가로x세로), 포맷, 용량 정보를 조회합니다.")
      .addAttachmentOption((opt) => opt.setName("이미지").setDescription("분석할 이미지 파일").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
      const file = interaction.options.getAttachment("이미지", true);

      if (!file.contentType?.startsWith("image/")) {
        await interaction.reply({ content: "이미지 파일만 분석할 수 있습니다.", ephemeral: true });
        return;
      }

      const container = ComponentsV2Builder.container(
        [
          ComponentsV2Builder.text(
            `# ${EMOJI_STRINGS.KCS} 이미지 상세 규격 정보\n• **파일명:** \`${file.name}\`\n• **해상도:** ${file.width || "알 수 없음"} x ${file.height || "알 수 없음"} px\n• **형식:** \`${file.contentType}\`\n• **파일 용량:** ${(file.size / 1024).toFixed(1)} KB`
          ),
        ],
        0x5865f2
      );
      await interaction.reply(ComponentsV2Builder.formatMessage(container));
    },
  },
];
