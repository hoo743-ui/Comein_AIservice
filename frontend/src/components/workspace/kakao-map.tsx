"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { Place } from "@/lib/types";

/**
 * 카카오 무료 지도 — NEXT_PUBLIC_KAKAO_MAP_KEY 가 있고 장소에 lat/lng 가 있을 때만 실지도 렌더.
 * 키가 없으면 null 을 반환하고, 호출부(campus)가 스키매틱 맵으로 폴백한다.
 * 키 발급(무료): https://developers.kakao.com → JavaScript 키 → .env 의 NEXT_PUBLIC_KAKAO_MAP_KEY
 *
 * 고도화: 건물마다 브랜드 톤 커스텀 오버레이(코드/이름), 다음 강의 강조(핑),
 *        출발지→다음 강의실 도보 경로선(Polyline), 포커스 시 부드러운 이동.
 */

declare global {
  interface Window {
    kakao?: any;
  }
}

const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

/** 키 사용 가능 여부 — 호출부에서 폴백 판단에 사용. */
export const kakaoAvailable = Boolean(KEY);

/** 경로선/강조 색 — 카카오 API 는 CSS 변수를 못 받으므로 브랜드 보라 고정값 사용. */
const BRAND = "#7c6bd6";

export type Origin = { lat: number; lng: number; label?: string };

/** 카카오 장소검색 결과(필요한 필드만). */
type PlaceResult = {
  id: string;
  place_name: string;
  road_address_name?: string;
  address_name?: string;
  x: string; // lng
  y: string; // lat
};

let sdkPromise: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (typeof window === "undefined" || !KEY) return Promise.reject(new Error("no key"));
  if (window.kakao?.maps) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false&libraries=services`;
    s.async = true;
    s.onload = () => window.kakao.maps.load(() => resolve());
    s.onerror = () => reject(new Error("kakao sdk load failed"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

// lucide MapPin 을 오버레이(DOM)용 인라인 SVG 로 — currentColor 상속.
const PIN_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

type MarkerState = "next" | "focus" | "base";

function pillClass(state: MarkerState) {
  return cn(
    "relative flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-soft transition-all",
    state === "next"
      ? "border-primary bg-primary text-primary-foreground"
      : state === "focus"
        ? "border-primary/50 bg-card text-foreground ring-2 ring-primary/30"
        : "border-border bg-card text-foreground hover:border-primary/40"
  );
}

function pillMarkup(place: Place, state: MarkerState) {
  const showName = state === "next" || state === "focus";
  const ping =
    state === "next"
      ? '<span class="pointer-events-none absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary/30"></span>'
      : "";
  const label = place.code ?? place.name;
  const name = showName
    ? `<span class="whitespace-nowrap">${place.name}</span>`
    : "";
  return `${ping}${PIN_SVG}<span>${label}</span>${name}`;
}

export function KakaoMap({
  places,
  focusId,
  nextId,
  origin = null,
  onPick,
  fallback = null,
}: {
  places: Place[];
  focusId: string | null;
  nextId: string | null;
  origin?: Origin | null;
  onPick: (id: string) => void;
  fallback?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const overlaysRef = React.useRef<Record<string, HTMLElement>>({});
  const routeRef = React.useRef<any>(null);
  const originOverlayRef = React.useRef<any>(null);
  const searchMarkerRef = React.useRef<any>(null);
  const infoRef = React.useRef<any>(null);
  const onPickRef = React.useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  // 지도 객체는 만들어졌지만 타일이 안 뜨는 경우(대개 카카오 콘솔 도메인 미등록) 안내용.
  const [tilesLoaded, setTilesLoaded] = React.useState(false);
  const [showHint, setShowHint] = React.useState(false);

  // 위치 검색(장소 키워드)
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PlaceResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  const located = React.useMemo(
    () => places.filter((p) => typeof p.lat === "number" && typeof p.lng === "number"),
    [places]
  );

  // 지도 + 건물 오버레이 1회 구성
  React.useEffect(() => {
    let cancelled = false;
    let hintTimer: number | undefined;
    if (!KEY || !ref.current || located.length === 0) return;
    loadSdk()
      .then(() => {
        if (cancelled || !ref.current) return;
        try {
          const kakao = window.kakao;
          const center = new kakao.maps.LatLng(located[0].lat, located[0].lng);
          const map = new kakao.maps.Map(ref.current, { center, level: 3 });
          mapRef.current = map;
          overlaysRef.current = {};

          const bounds = new kakao.maps.LatLngBounds();
          located.forEach((p) => {
            const pos = new kakao.maps.LatLng(p.lat, p.lng);
            bounds.extend(pos);

            const el = document.createElement("button");
            el.type = "button";
            el.className = pillClass("base");
            el.innerHTML = pillMarkup(p, "base");
            el.addEventListener("click", () => onPickRef.current(p.id));
            overlaysRef.current[p.id] = el;

            new kakao.maps.CustomOverlay({
              position: pos,
              content: el,
              xAnchor: 0.5,
              yAnchor: 0.5,
              clickable: true,
              map,
            });
          });

          if (located.length > 1) map.setBounds(bounds);
          setReady(true);

          // 타일 로드 감지 — 성공하면 안내 숨김, 일정 시간 내 미로드 시 도메인 안내 노출.
          kakao.maps.event.addListener(map, "tilesloaded", () => {
            if (cancelled) return;
            setTilesLoaded(true);
            setShowHint(false);
          });
          hintTimer = window.setTimeout(() => {
            if (!cancelled) setShowHint(true);
          }, 4500);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (hintTimer) window.clearTimeout(hintTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length]);

  // 오버레이 강조(다음/포커스) + 포커스 이동 + 경로선 갱신
  React.useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao) return;
    const kakao = window.kakao;

    // 1) 오버레이 상태 재적용
    located.forEach((p) => {
      const el = overlaysRef.current[p.id];
      if (!el) return;
      const state: MarkerState =
        p.id === nextId ? "next" : p.id === focusId ? "focus" : "base";
      el.className = pillClass(state);
      el.innerHTML = pillMarkup(p, state);
    });

    // 2) 포커스(없으면 다음 강의)로 부드럽게 이동
    const target = located.find((p) => p.id === (focusId ?? nextId));
    if (target) mapRef.current.panTo(new kakao.maps.LatLng(target.lat, target.lng));

    // 3) 경로선: 출발지 → 다음 강의실
    if (routeRef.current) {
      routeRef.current.setMap(null);
      routeRef.current = null;
    }
    if (originOverlayRef.current) {
      originOverlayRef.current.setMap(null);
      originOverlayRef.current = null;
    }
    // 경로 목적지 = 포커스한 건물(없으면 다음 강의) — 선택에 따라 경로가 연동된다.
    const dest = located.find((p) => p.id === (focusId ?? nextId));
    if (origin && dest) {
      const from = new kakao.maps.LatLng(origin.lat, origin.lng);
      const to = new kakao.maps.LatLng(dest.lat, dest.lng);
      routeRef.current = new kakao.maps.Polyline({
        path: [from, to],
        strokeWeight: 4,
        strokeColor: BRAND,
        strokeOpacity: 0.85,
        strokeStyle: "shortdash",
        map: mapRef.current,
      });

      const dot = document.createElement("div");
      dot.title = origin.label ?? "출발";
      dot.className =
        "size-3 rounded-full border-2 border-background bg-muted-foreground shadow-soft";
      originOverlayRef.current = new kakao.maps.CustomOverlay({
        position: from,
        content: dot,
        xAnchor: 0.5,
        yAnchor: 0.5,
        map: mapRef.current,
      });
    }
  }, [focusId, nextId, origin, ready, located]);

  // 위치 검색 — 카카오 장소검색(services). 지도 중심 근처를 우선 노출.
  const runSearch = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const q = query.trim();
      const kakao = window.kakao;
      if (!q || !kakao?.maps?.services || !mapRef.current) return;
      setSearching(true);
      const ps = new kakao.maps.services.Places();
      const opts = located[0]
        ? { location: new kakao.maps.LatLng(located[0].lat, located[0].lng), radius: 20000 }
        : undefined;
      ps.keywordSearch(
        q,
        (data: PlaceResult[], status: string) => {
          setSearching(false);
          setSearched(true);
          setResults(status === kakao.maps.services.Status.OK ? data.slice(0, 6) : []);
        },
        opts
      );
    },
    [query, located]
  );

  const pickResult = React.useCallback((place: PlaceResult) => {
    const kakao = window.kakao;
    if (!kakao?.maps || !mapRef.current) return;
    const pos = new kakao.maps.LatLng(Number(place.y), Number(place.x));
    if (!searchMarkerRef.current) {
      searchMarkerRef.current = new kakao.maps.Marker({ position: pos });
      infoRef.current = new kakao.maps.InfoWindow({ zIndex: 3 });
    }
    searchMarkerRef.current.setPosition(pos);
    searchMarkerRef.current.setMap(mapRef.current);
    infoRef.current.setContent(
      `<div style="padding:6px 10px;font-size:12px;font-weight:600;white-space:nowrap;color:#191919">${place.place_name}</div>`
    );
    infoRef.current.open(mapRef.current, searchMarkerRef.current);
    mapRef.current.setLevel(3);
    mapRef.current.panTo(pos);
    setResults([]);
    setSearched(false);
    setQuery(place.place_name);
  }, []);

  const clearSearch = React.useCallback(() => {
    setQuery("");
    setResults([]);
    setSearched(false);
    if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
    if (infoRef.current) infoRef.current.close();
  }, []);

  if (!KEY || located.length === 0 || failed) return <>{fallback}</>;

  return (
    <div className="relative flex w-full flex-1">
      <div ref={ref} className="w-full flex-1 rounded-xl border border-border" />

      {/* 위치 검색칸 */}
      <div className="absolute left-3 right-3 top-3 z-10 sm:right-auto sm:w-80">
        <form
          onSubmit={runSearch}
          className="flex items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-soft backdrop-blur-sm"
        >
          <svg
            className="size-4 shrink-0 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="장소 검색 (예: 가천대 스타벅스)"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="검색 지우기"
              className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95"
          >
            검색
          </button>
        </form>

        {/* 검색 결과 */}
        {(results.length > 0 || (searched && !searching)) && (
          <ul className="mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-border bg-card/95 p-1 shadow-soft backdrop-blur-sm">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <span className="text-sm font-semibold text-foreground">{r.place_name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.road_address_name || r.address_name}
                  </span>
                </button>
              </li>
            ))}
            {searched && !searching && results.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground">
                검색 결과가 없어요
              </li>
            )}
          </ul>
        )}
      </div>

      {showHint && !tilesLoaded && (
        <div className="absolute inset-0 grid place-items-center rounded-xl border border-border bg-background/85 p-6 backdrop-blur-sm">
          <div className="max-w-sm text-center">
            <p className="font-display text-base font-semibold text-foreground">
              지도 타일을 불러오지 못했어요
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              카카오 키는 인식됐지만 타일이 안 옵니다. 대부분{" "}
              <b className="text-foreground">플랫폼 도메인 미등록</b>이 원인이에요.
            </p>
            <ol className="mx-auto mt-3 max-w-xs space-y-1 text-left text-xs text-muted-foreground">
              <li>1. developers.kakao.com → 내 애플리케이션</li>
              <li>
                2. 앱 선택 → <b className="text-foreground">플랫폼 → Web</b>
              </li>
              <li>
                3. 사이트 도메인에{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  http://localhost:3000
                </code>{" "}
                추가
              </li>
              <li>4. 저장 후 이 페이지 새로고침</li>
            </ol>
            <p className="mt-3 text-[11px] text-muted-foreground/70">
              F12 콘솔에 표시되는 카카오 오류 메시지도 확인해 보세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
