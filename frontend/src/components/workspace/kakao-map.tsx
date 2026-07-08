"use client";

import * as React from "react";

import type { Place } from "@/lib/types";

/**
 * 카카오 무료 지도 — NEXT_PUBLIC_KAKAO_MAP_KEY 가 있고 장소에 lat/lng 가 있을 때만 실지도 렌더.
 * 키가 없으면 null 을 반환하고, 호출부(campus)가 스키매틱 맵으로 폴백한다.
 * 키 발급(무료): https://developers.kakao.com → JavaScript 키 → .env 의 NEXT_PUBLIC_KAKAO_MAP_KEY
 */

declare global {
  interface Window {
    kakao?: any;
  }
}

const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

/** 키 사용 가능 여부 — 호출부에서 폴백 판단에 사용. */
export const kakaoAvailable = Boolean(KEY);

let sdkPromise: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (typeof window === "undefined" || !KEY) return Promise.reject(new Error("no key"));
  if (window.kakao?.maps) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`;
    s.async = true;
    s.onload = () => window.kakao.maps.load(() => resolve());
    s.onerror = () => reject(new Error("kakao sdk load failed"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

export function KakaoMap({
  places,
  focusId,
  nextId,
  onPick,
}: {
  places: Place[];
  focusId: string | null;
  nextId: string | null;
  onPick: (id: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const markersRef = React.useRef<Record<string, any>>({});
  const [ready, setReady] = React.useState(false);

  const located = React.useMemo(
    () => places.filter((p) => typeof p.lat === "number" && typeof p.lng === "number"),
    [places]
  );

  React.useEffect(() => {
    let cancelled = false;
    if (!KEY || !ref.current || located.length === 0) return;
    loadSdk()
      .then(() => {
        if (cancelled || !ref.current) return;
        const kakao = window.kakao;
        const center = new kakao.maps.LatLng(located[0].lat, located[0].lng);
        const map = new kakao.maps.Map(ref.current, { center, level: 3 });
        mapRef.current = map;
        const bounds = new kakao.maps.LatLngBounds();
        located.forEach((p) => {
          const pos = new kakao.maps.LatLng(p.lat, p.lng);
          bounds.extend(pos);
          const marker = new kakao.maps.Marker({ position: pos, map, title: p.name });
          kakao.maps.event.addListener(marker, "click", () => onPick(p.id));
          markersRef.current[p.id] = marker;
        });
        if (located.length > 1) map.setBounds(bounds);
        setReady(true);
      })
      .catch(() => {
        /* 로드 실패 시 폴백은 호출부에서 처리 */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length]);

  // 포커스/다음 강의 변경 시 해당 위치로 이동
  React.useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao) return;
    const target = located.find((p) => p.id === (focusId ?? nextId));
    if (target) mapRef.current.panTo(new window.kakao.maps.LatLng(target.lat, target.lng));
  }, [focusId, nextId, ready, located]);

  if (!KEY || located.length === 0) return null;

  return <div ref={ref} className="h-full w-full rounded-xl" />;
}
