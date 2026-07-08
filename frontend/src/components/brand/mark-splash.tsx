import Image from "next/image";

/**
 * 진입 스플래시 비주얼 — 딥 인디고 라디얼(브랜드 하모니) 위에 Comein 로고.
 * 로고 자체 배경(다크)과 이음새 없이 떠 보이도록 라디얼 중심을 로고 배경 톤에 맞춘다.
 * 오버레이 opacity 는 호출부(motion)에서 제어한다.
 */
export function MarkSplash() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          "radial-gradient(120% 120% at 50% 46%, #1a1728 0%, #221d3c 46%, #121020 100%)",
      }}
    >
      <Image
        src="/brand-splash.webp"
        alt="Comein — 생각은 흩어집니다. 질서는 만들어집니다."
        width={1000}
        height={1000}
        priority
        className="h-auto w-[min(82vw,500px)]"
      />
    </div>
  );
}
