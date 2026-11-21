import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { ComponentsV2Builder } from "../components-v2/builder.js";
import { EMOJI_STRINGS } from "../constants/emojis.js";

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName("도움말")
    .setDescription("Sora 봇의 모든 부모 명령어와 기능 안내서를 확인합니다."),

  async execute(interaction: ChatInputCommandInteraction) {
    const container = ComponentsV2Builder.container(
      [
        ComponentsV2Builder.text(
          `# ${EMOJI_STRINGS.SORA} Sora 공식 부모 명령어 안내서\n모든 명령어는 카테고리별 **부모 명령어(Parent Command) 및 서브커맨드** 체계로 정렬되어 있습니다.\n\n🌐 **공식 지원 서버:** https://kcs.koharu.live/support-server/kcs\n\n### 🛡️ 제재 및 보안 (관리자 전용)\n• \`/경고 [추가 | 목록 | 제거 | 초기화]\` — 멤버 경고 누적 관리\n• \`/타임아웃 [설정 | 해제]\` — 유저 채팅 제한\n• \`/차단 [설정 | 해제 | 목록]\` — 서버 밴 관리\n• \`/추방 [유저] [사유]\` — 멤버 즉시 킥\n• \`/청소 [개수]\` — 최근 메시지 대량 삭제\n• \`/채널 [잠금 | 느린모드]\` — 채널 채팅 잠금 및 슬로우모드\n\n### ⚙️ 서버 운영 및 자동화\n• \`/서버 [정보 | 설정]\` — 서버 스펙 및 봇 설정 현황\n• \`/안내 [입장 | 퇴장]\` — 가입 환영/퇴장 메시지 설정\n• \`/자동역할 [추가 | 목록 | 삭제]\` — 신규 유저/봇 역할 자동 지급\n• \`/자동메시지 [추가 | 목록 | 삭제]\` — 주기적 공지 자동 발송\n• \`/인증 [패널 | 설정]\` — 휴대폰(Sendwich), 이메일(Resend) 보안 인증 패널\n• \`/티켓 [패널 | 설정 | 닫기]\` — 1:1 고객지원 비공개 채널\n\n### 📚 지식 & 유틸리티\n• \`/위키 [조회 | 작성 | 편집 | 삭제 | 목록 | 검색]\` — 서버 전용 백과사전\n• \`/도구 [계산기 | 단위변환 | 진법변환 | 날씨 | 환율 | qr | 시간변환]\` — 생활 편의 유틸리티\n• \`/통계 [요약]\` — 봇 응답 속도 및 사용량 집계\n\n### 💰 포인트 & 엔터테인먼트\n• \`/포인트 [잔액 | 출석 | 송금 | 랭킹 | 지급]\` — 경제 시스템\n• \`/상점 [목록 | 구매 | 등록]\` — 포인트 전용 상점\n• \`/미니게임 [도박 | 복권 | 룰렛 | 업다운 | 타자연습]\` — 미니게임 모음\n\n> 웹 대시보드: https://sora.koharu.live/dashboard`
        ),
      ],
      0x5865f2
    );

    await interaction.reply(ComponentsV2Builder.formatMessage(container));
  },
};
