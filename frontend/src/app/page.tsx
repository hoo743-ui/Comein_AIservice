/**
 * Comein 홈 — Chat이 곧 인터페이스.
 * 3분할 레이아웃(사이드바 · Chat · 컨텍스트 패널)의 진입점.
 * 상세 설계: ../../docs/04_GUI_UX.md
 */
export default function Home() {
  return (
    <main className="flex min-h-screen">
      <aside className="w-60 border-r p-4">사이드바</aside>
      <section className="flex flex-1 flex-col p-4">
        <h1 className="text-xl font-semibold">Come in. Your workspace is thinking for you.</h1>
        <div className="mt-4 flex-1 rounded-lg border p-4">대화 스트림 + 인라인 카드</div>
        <div className="mt-4 flex gap-2">
          <input className="flex-1 rounded-md border px-3 py-2" placeholder="무엇을 도와드릴까요?" />
          <button className="rounded-md border px-4">➤</button>
        </div>
      </section>
      <aside className="w-72 border-l p-4">컨텍스트 패널 (오늘 일정 · 임박 Todo · 최근 메모)</aside>
    </main>
  );
}
