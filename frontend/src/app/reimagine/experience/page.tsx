"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Experience 는 Opening 으로 통합되었습니다.
 * Co·me·in(Context · Memory · Insight) 리빌이 곧 '경험'이므로 하나의 시네마틱으로 합칩니다.
 */
export default function ExperienceRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/reimagine/opening");
  }, [router]);
  return null;
}
