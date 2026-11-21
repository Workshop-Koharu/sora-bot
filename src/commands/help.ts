import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const helpCommand = {
  // 30. /도움말
  data: new SlashCommandBuilder()
    .setName("도움말")
    .setDescription("Sora 봇의 모든 기능과 명령어 안내서를 확인합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "관리자 권한이 부족합니다.", ephemeral: true });
      return;
    }

    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.SORA} Sora 관리자 공식 가이드북\n**Koharu Coding Server (KCS) 전용 올인원 디스코드 봇**\nDiscord Components V2 구조로 완벽히 리뉴얼된 프리미엄 관리 도구입니다.\n\n🌐 **공식 지원 서버:** https://kcs.koharu.live/support-server/kcs\n\n### 명령어 카테고리\n• **인증/보안 (1~2):** \`/인증구성\`, \`/채널잠금\`, \`/채널삭제\`, \`/채널설정\`\n• **서버/관리 (3~8):** \`/서버정보\`, \`/서버설정목록\`, \`/가입안내설정\`, \`/가입환영문구\`, \`/퇴장안내설정\`, \`/멤버정보\`, \`/봇상태\`\n• **제재/보안 (9~17):** \`/경고\`, \`/경고제거\`, \`/경고목록\`, \`/타임아웃\`, \`/타임아웃해제\`, \`/킥\`, \`/밴\`, \`/밴해제\`, \`/차단목록\`\n• **문의/통계 (18~23):** \`/문의구성\`, \`/일일요약\`, \`/주간요약\`, \`/월간요약\`, \`/명령어통계\`\n• **자동화 (24~29):** \`/자동역할설정\`, \`/자동역할목록\`, \`/자동역할삭제\`, \`/자동메시지설정\`, \`/자동메시지목록\`, \`/자동메시지중지\`\n• **위키 시스템 (31~39):** 문서작성, 편집, 검색, 목록, 이동, 분류, 태그, 연결, 링크\n• **도구/유틸리티 (40~55):** 계산기, 단위/진법/날짜/시간대/타임스탬프 변환, 타이머, 스톱워치, D데이, 확률, 날씨, 환율, QR코드, 파일/이미지분석\n• **미니게임 (56~58):** 랜덤추첨(룰렛), 업다운, 타자연습\n• **포인트/경제 (59~69):** 출석체크, 잔액, 송금, 도박, 랭킹, 상점, 구매, 인벤토리, 선물, 복권, 포인트관리`
        ),
        ComponentsV2Builder.separator(true, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.stringSelect(
            "help_category_select",
            [
              { label: "인증 & 채널 보안", value: "cat_security", description: "Sendwich, Resend, 채널 권한 제어" },
              { label: "멤버 관리 & 제재", value: "cat_moderation", description: "경고, 타임아웃, 킥, 밴 기록" },
              { label: "위키 지식 엔진", value: "cat_wiki", description: "서버 지식 문서화, 버전, 상호 링크" },
              { label: "포인트 & 경제", value: "cat_points", description: "출석, 송금, 도박, 상점, 복권" },
              { label: "생활 도구 & 유틸", value: "cat_utility", description: "계산기, QR, 환율, 단위변환 등" },
            ],
            "상세 도움말 카테고리를 선택하세요"
          )
        ),
        ComponentsV2Builder.separator(false, 1),
        ComponentsV2Builder.actionRow(
          ComponentsV2Builder.emojiButton("SETTINGS", "help_open_settings"),
          ComponentsV2Builder.emojiButton("SHARE", "help_share_link")
        ),
      ],
      0x5865f2
    );

    await interaction.reply(ComponentsV2Builder.formatMessage(container, true));
  },
};
