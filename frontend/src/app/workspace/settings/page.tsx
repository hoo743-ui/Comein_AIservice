"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Bell,
  CalendarDays,
  Languages,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { inputClass } from "@/components/ui/modal";
import { PageShell } from "@/components/workspace/page-shell";
import { useWorkspace, type Language } from "@/lib/store";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const settings = useWorkspace((s) => s.settings);
  const updateSettings = useWorkspace((s) => s.updateSettings);
  const { theme, setTheme } = useTheme();
  const t = useT();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const themes = [
    { key: "light", label: t("set.light"), icon: Sun },
    { key: "dark", label: t("set.dark"), icon: Moon },
    { key: "system", label: t("set.system"), icon: Monitor },
  ];
  const langs: { key: Language; label: string }[] = [
    { key: "ko", label: t("set.korean") },
    { key: "en", label: t("set.english") },
  ];

  return (
    <PageShell title={t("set.title")} subtitle={t("set.subtitle")} icon={<SettingsIcon className="size-5" />}>
      <div className="mx-auto max-w-4xl space-y-5">
        <Section icon={<UserRound className="size-4" />} title={t("set.profile")} desc={t("set.profileDesc")}>
          <Row label={t("set.displayName")} desc={t("set.displayNameDesc")}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full brand-gradient text-sm font-semibold text-white">
                {settings.name.slice(0, 1) || "나"}
              </div>
              <input
                className={cn(inputClass, "w-56")}
                value={settings.name}
                onChange={(e) => updateSettings({ name: e.target.value })}
                placeholder={t("set.displayName")}
              />
            </div>
          </Row>
        </Section>

        <Section icon={<Languages className="size-4" />} title={t("set.languageSection")} desc={t("set.languageDesc")}>
          <Row label={t("set.languageRow")} desc={t("set.languageRowDesc")}>
            <div className="flex gap-2">
              {langs.map((l) => {
                const active = settings.language === l.key;
                return (
                  <button
                    key={l.key}
                    onClick={() => updateSettings({ language: l.key })}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </Row>
        </Section>

        <Section icon={<Monitor className="size-4" />} title={t("set.screen")} desc={t("set.screenDesc")}>
          <Row label={t("set.theme")} desc={t("set.themeDesc")}>
            <div className="flex gap-2">
              {themes.map((th) => {
                const active = mounted && theme === th.key;
                return (
                  <button
                    key={th.key}
                    onClick={() => setTheme(th.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <th.icon className="size-4" />
                    {th.label}
                  </button>
                );
              })}
            </div>
          </Row>
        </Section>

        <Section icon={<CalendarDays className="size-4" />} title={t("set.calendar")} desc={t("set.calendarDesc")}>
          <Row label={t("set.weekStart")} desc={t("set.weekStartDesc")}>
            <select
              className={cn(inputClass, "w-40")}
              value={settings.weekStart}
              onChange={(e) => updateSettings({ weekStart: e.target.value as "sun" | "mon" })}
            >
              <option value="sun">{t("set.sunday")}</option>
              <option value="mon">{t("set.monday")}</option>
            </select>
          </Row>
        </Section>

        <Section icon={<Bell className="size-4" />} title={t("set.notif")} desc={t("set.notifDesc")}>
          <ToggleRow
            label={t("set.notifToggle")}
            desc={t("set.notifToggleDesc")}
            checked={settings.notifications}
            onChange={(v) => updateSettings({ notifications: v })}
          />
        </Section>

        <Section icon={<Sparkles className="size-4" />} title={t("set.ai")} desc={t("set.aiDesc")}>
          <ToggleRow
            label={t("set.autoConfirm")}
            desc={t("set.autoConfirmDesc")}
            checked={settings.autoConfirm}
            onChange={(v) => updateSettings({ autoConfirm: v })}
          />
        </Section>
      </div>
    </PageShell>
  );
}

function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="elevated overflow-hidden rounded-2xl border border-border">
      <div className="flex items-center gap-2.5 border-b border-border/60 bg-muted/30 px-6 py-4">
        <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
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
    <Row label={label} desc={desc}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </Row>
  );
}
