"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { useWorkspace } from "@/lib/store";

/** 설정 창 — 표시 이름 · 테마 · 주 시작 요일 · 알림 · AI 자동 확정. */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useWorkspace((s) => s.settings);
  const updateSettings = useWorkspace((s) => s.updateSettings);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const themes = [
    { key: "light", label: "라이트", icon: Sun },
    { key: "dark", label: "다크", icon: Moon },
    { key: "system", label: "시스템", icon: Monitor },
  ];

  return (
    <Modal open={open} onClose={onClose} title="설정" description="워크스페이스 환경을 조정합니다.">
      <div className="space-y-5">
        <Field label="표시 이름">
          <input
            className={inputClass}
            value={settings.name}
            onChange={(e) => updateSettings({ name: e.target.value })}
            placeholder="이름"
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-foreground">테마</span>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const active = mounted && theme === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <t.icon className="size-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="주 시작 요일">
          <select
            className={inputClass}
            value={settings.weekStart}
            onChange={(e) => updateSettings({ weekStart: e.target.value as "sun" | "mon" })}
          >
            <option value="sun">일요일</option>
            <option value="mon">월요일</option>
          </select>
        </Field>

        <ToggleRow
          label="알림"
          desc="일정·할 일 리마인드 알림을 받습니다."
          checked={settings.notifications}
          onChange={(v) => updateSettings({ notifications: v })}
        />
        <ToggleRow
          label="AI 제안 일정 자동 확정"
          desc="켜면 AI가 만든 일정을 확인 없이 바로 확정합니다."
          checked={settings.autoConfirm}
          onChange={(v) => updateSettings({ autoConfirm: v })}
        />
      </div>
    </Modal>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
