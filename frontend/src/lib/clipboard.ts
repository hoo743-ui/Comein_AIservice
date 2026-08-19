/**
 * Comein · 복사 — 되면 되고, 안 되면 안 됐다고 말한다.
 *
 * 예전에는 `navigator.clipboard?.writeText(x).then(…)` 한 줄이었다. 클립보드가 없는 자리에서는
 * 물음표가 사슬 전체를 끊어 **아무 일도 일어나지 않고**, 화면도 아무 말을 하지 않았다.
 * 누른 사람은 자기가 잘못 눌렀다고 생각한다 — 이 저장소에서 가장 나쁜 답이다.
 *
 * 언제 없는가: 안전한 맥락(https · localhost)이 아닐 때. 개발 중 `http://192.168.…:3000` 으로
 * 다른 기기에서 열어 보는 경우가 정확히 그렇다. 그래서 옛 방법을 하나 더 둔다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 권한이 막혔을 수도 있다 — 아래로 한 번 더 */
  }
  try {
    // 화면에 보이지 않게 두되 `display:none` 은 안 된다 — 선택이 안 되는 요소는 복사도 안 된다.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");   // 낡았지만 여기서는 이것뿐이다
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
