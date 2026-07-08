import { Sidebar } from "@/components/layout/sidebar";
import { ContextPanel } from "@/components/layout/context-panel";
import { EnterReveal } from "@/components/enter-transition";

/**
 * 워크스페이스 3분할 셸 — 사이드바 · 중앙(Chat/기능) · 컨텍스트 패널.
 * Chat(/workspace)이 홈이며, 나머지 기능 페이지도 이 셸 안에서 렌더된다.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-app flex h-screen overflow-hidden">
      <EnterReveal />
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      <ContextPanel />
    </div>
  );
}
