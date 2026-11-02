"use client";

import { ArrowClockwise, CaretLeft, Lightbulb, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { addShelly, changeLight, connectShelly, disconnectLights, editShelly, getLights, removeShelly, startHueLink } from "@/app/actions/lights";
import { doneVariant } from "@/lib/bank-callback";
import { brandSummary, groupByRoom, isLit, normalizeShellyHost, type BrandSummary, type ConnectionStatus, type Light, type LightChange, type LightProvider, type LightsOverview, type ShellyDevice } from "@/lib/lights";
import { Field, PrimaryButton } from "../form";
import { BulbArt, WallSwitchArt } from "../illustrations";
import { PageHeader, Screen, SectionTitle } from "../screen";
import { Sheet } from "../sheet";
import { Tile } from "../tile";
import { useUI } from "../ui-provider";

/** Wait before sending a slider value. Shelly allows one call per second per account. */
const SLIDER_WAIT_MS: Record<LightProvider, number> = { hue: 400, shelly: 1100 };
/** How long a lights page trusts the last overview instead of asking the vendors again. */
const OVERVIEW_FRESH_MS = 15_000;

const ROW_BUTTON = "press h-11 flex-none rounded-xl bg-bg px-3 text-[13px] font-semibold disabled:opacity-40";

type Loaded = { status: "loading" } | { status: "ready"; data: LightsOverview } | { status: "error"; reason: "unavailable" | "failed" };

/** Moving between the overview and a brand page must not spend a second Shelly call. */
let lastOverview: { at: number; data: LightsOverview } | null = null;

const forgetOverview = () => {
  lastOverview = null;
};

const freshOverview = () => (lastOverview && Date.now() - lastOverview.at < OVERVIEW_FRESH_MS ? lastOverview.data : null);

function useLights(only?: LightProvider) {
  const [loaded, setLoaded] = useState<Loaded>(() => {
    const fresh = freshOverview();
    return fresh ? { status: "ready", data: fresh } : { status: "loading" };
  });
  const [refreshing, setRefreshing] = useState(false);

  const apply = useCallback((res: Awaited<ReturnType<typeof getLights>>) => {
    if (res.ok) {
      if (!only) lastOverview = { at: Date.now(), data: res };
      setLoaded({ status: "ready", data: res });
    } else {
      setLoaded({ status: "error", reason: res.error === "unavailable" ? "unavailable" : "failed" });
    }
  }, [only]);

  const load = useCallback(async () => {
    forgetOverview();
    setRefreshing(true);
    try {
      apply(await getLights({ provider: only }));
    } catch {
      setLoaded({ status: "error", reason: "failed" });
    } finally {
      setRefreshing(false);
    }
  }, [apply, only]);

  // Next hides a page behind <Activity> instead of unmounting it, so this runs on every return, not only on mount.
  useEffect(() => {
    let alive = true;
    const fresh = freshOverview();
    if (fresh) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the kept state may be older than the overview
      setLoaded({ status: "ready", data: fresh });
    } else {
      getLights({ provider: only })
        .then((res) => alive && apply(res))
        .catch(() => alive && setLoaded({ status: "error", reason: "failed" }));
    }
    return () => {
      alive = false;
      // Navigating discards a running server action: a refresh started here would never settle.
      setRefreshing(false);
    };
  }, [apply, only]);

  return { loaded, setLoaded, refreshing, load };
}

function Back({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} transitionTypes={["nav-back"]} className="press -ml-2 mb-2 inline-flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-ink-2">
      <CaretLeft size={18} /> {label}
    </Link>
  );
}

function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  const t = useTranslations("lights");
  return (
    <button type="button" onClick={onClick} disabled={busy} aria-label={t("refresh")}
      className="press grid h-11 w-11 place-items-center rounded-full bg-surface">
      <ArrowClockwise size={18} className={clsx(busy && "animate-spin")} />
    </button>
  );
}

function LoadError({ reason, retry }: { reason: "unavailable" | "failed"; retry: () => void }) {
  const t = useTranslations("lights");
  return (
    <div className="mt-[18px] rounded-[22px] bg-surface p-4 text-sm">
      <p>{t(reason)}</p>
      {reason === "failed" && <button type="button" className={clsx(ROW_BUTTON, "mt-3 w-full")} onClick={retry}>{t("retry")}</button>}
    </div>
  );
}

function useSummaryText() {
  const t = useTranslations("lights");
  return (summary: BrandSummary): string => {
    switch (summary.kind) {
      case "notConnected": return t("notConnected");
      case "expired": return t("expired");
      case "unreachable": return t("unreachableShort");
      case "empty": return t("noLights");
      case "lights": return summary.on === 0 ? t("allOff") : t("someOn", { on: summary.on, total: summary.total });
    }
  };
}

/* ---------- Overview: one tile per brand ---------- */

export function LightsScreen() {
  return (
    <Screen>
      <Overview />
    </Screen>
  );
}

function Overview() {
  const t = useTranslations("lights");
  const { loaded, refreshing, load } = useLights();
  const summaryText = useSummaryText();
  const sub = (provider: LightProvider) => (loaded.status === "ready" ? summaryText(brandSummary(loaded.data, provider)) : "");

  return (
    <>
      <Back href="/" label={t("back")} />
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} action={<RefreshButton onClick={load} busy={refreshing} />} />
      {loaded.status === "error" ? (
        <LoadError reason={loaded.reason} retry={load} />
      ) : (
        <div className="mt-[18px] flex flex-col gap-2.5">
          <Tile href="/huis/lampen/hue" tone="bg-tile-lights" h="h-44" i={0} title={t("hue")} sub={sub("hue")}>
            <BulbArt />
          </Tile>
          <Tile href="/huis/lampen/shelly" tone="bg-tile-money" h="h-44" i={1} title={t("shelly")} sub={sub("shelly")}>
            <WallSwitchArt />
          </Tile>
        </div>
      )}
    </>
  );
}

/* ---------- One brand: its lights and its link ---------- */

export function LightsBrandScreen({ provider }: { provider: LightProvider }) {
  return (
    <Screen>
      <Brand provider={provider} />
    </Screen>
  );
}

function Brand({ provider }: { provider: LightProvider }) {
  const t = useTranslations("lights");
  const { toast } = useUI();
  const { loaded, setLoaded, refreshing, load } = useLights(provider);
  const summaryText = useSummaryText();

  // Result of the Hue redirect (/huis/lampen/hue?hue=<outcome>): one toast, then a clean URL.
  useEffect(() => {
    if (provider !== "hue") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("hue");
    if (result === null) return;
    const v = doneVariant(result);
    toast(t(v === "linked" ? "hueLinked" : v === "cancelled" ? "hueCancelled" : "hueFailed"));
    window.history.replaceState(null, "", window.location.pathname);
  }, [provider, t, toast]);

  /** Shows the change at once; on failure the real state comes back from the vendor. */
  const change = async (light: Light, patch: LightChange) => {
    forgetOverview();
    setLoaded((l) =>
      l.status !== "ready"
        ? l
        : { ...l, data: { ...l.data, lights: l.data.lights.map((x) => (x.id === light.id ? { ...x, ...patch } : x)) } },
    );
    let ok = false;
    try {
      ok = (await changeLight({ id: light.id, ...patch })).ok;
    } catch {
      /* reported below */
    }
    if (!ok) {
      toast(t("failed"));
      await load();
    }
  };

  const data = loaded.status === "ready" ? loaded.data : null;
  const summary = data && brandSummary(data, provider);
  const lights = data ? data.lights.filter((l) => l.provider === provider) : [];

  return (
    <>
      <Back href="/huis/lampen" label={t("title")} />
      <PageHeader eyebrow={t("title")} title={t(provider)} action={<RefreshButton onClick={load} busy={refreshing} />} />
      {(summary?.kind === "lights" || summary?.kind === "unreachable") && (
        <p role="status" className={clsx("mt-1 text-sm", summary.kind === "unreachable" ? "font-medium text-bad" : "text-ink-3")}>{summaryText(summary)}</p>
      )}

      {loaded.status === "loading" && (
        <div aria-hidden="true" className="mt-7 grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-[22px]" />)}
        </div>
      )}

      {loaded.status === "error" && <LoadError reason={loaded.reason} retry={load} />}

      {summary?.kind === "empty" && (
        <p className="mt-[18px] rounded-[22px] bg-surface p-5 text-center text-ink-3">{t(provider === "hue" ? "emptyHue" : "emptyShelly")}</p>
      )}

      {groupByRoom(lights).map((group) => (
        <section key={group.room ?? ""}>
          <SectionTitle aside={t("someOn", { on: group.lights.filter(isLit).length, total: group.lights.length })}>
            {group.room ?? t("noRoom")}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {group.lights.map((light) => <LightCard key={light.id} light={light} onChange={(patch) => change(light, patch)} />)}
          </div>
        </section>
      ))}

      {data && <BrandLink provider={provider} data={data} reload={load} />}
    </>
  );
}

function LightCard({ light, onChange }: { light: Light; onChange: (patch: LightChange) => void }) {
  const t = useTranslations("lights");
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<(() => void) | null>(null);
  // Leaving the page sends what was still waiting: it would be lost, and the kept slider would stay on the unsent value.
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    pending.current?.();
  }, []);

  const slide = (value: number) => {
    setDraft(value);
    window.clearTimeout(timer.current);
    pending.current = () => {
      pending.current = null;
      setDraft(null);
      onChange({ brightness: value });
    };
    timer.current = window.setTimeout(() => pending.current?.(), SLIDER_WAIT_MS[light.provider]);
  };

  const lit = isLit(light);
  const level = draft ?? light.brightness;

  return (
    <div className={clsx("flex flex-col rounded-[22px] transition-colors duration-200", lit ? "bg-tile-lights" : "bg-surface", !light.online && "opacity-60")}>
      <button type="button" role="switch" aria-checked={light.on} aria-label={t("toggle", { name: light.name })} disabled={!light.online}
        onClick={() => onChange({ on: !light.on })} className="press flex min-h-28 flex-1 flex-col items-start justify-between gap-3 rounded-[22px] p-3.5 text-left">
        <span className={clsx("grid h-10 w-10 place-items-center rounded-full transition-colors duration-200", lit ? "bg-accent text-white" : "bg-bg text-ink-3")}>
          <Lightbulb size={20} weight={lit ? "fill" : "regular"} />
        </span>
        <span className="w-full min-w-0">
          <span className="line-clamp-2 font-semibold leading-tight">{light.name}</span>
          <span className="num mt-0.5 block text-[13px] text-ink-2">
            {!light.online ? t("offline") : !light.on ? t("off") : level !== null ? t("onLevel", { level }) : t("on")}
          </span>
        </span>
      </button>
      {lit && light.brightness !== null && (
        <input type="range" min={1} max={100} value={level ?? 1} aria-label={t("brightness", { name: light.name })}
          onChange={(e) => slide(Number(e.target.value))} className="mx-3.5 mb-1.5 h-11 min-w-0 accent-[var(--accent-strong)]" />
      )}
    </div>
  );
}

function BrandLink({ provider, data, reload }: { provider: LightProvider; data: LightsOverview; reload: () => Promise<void> }) {
  const t = useTranslations("lights");
  const { toast } = useUI();
  const [shellyOpen, setShellyOpen] = useState(false);
  const [going, setGoing] = useState(false);
  const status = data.connections[provider];

  const linkHue = async () => {
    setGoing(true);
    try {
      const res = await startHueLink();
      if (res.ok) {
        window.location.assign(res.url);
        return;
      }
      toast(t(res.error === "unavailable" ? "unavailable" : "failed"));
    } catch {
      toast(t("failed"));
    }
    setGoing(false);
  };

  let action: ReactNode;
  if (provider === "shelly") {
    action = (
      <button type="button" className={ROW_BUTTON} onClick={() => setShellyOpen(true)}>
        {t(status === "active" ? "manage" : status === "expired" ? "reconnect" : "connect")}
      </button>
    );
  } else if (status === "active") {
    action = null;
  } else if (data.hueAvailable) {
    action = (
      <button type="button" className={ROW_BUTTON} disabled={going} onClick={linkHue}>
        {t(status === "expired" ? "reconnect" : "connect")}
      </button>
    );
  } else {
    action = <span className="text-right text-[13px] text-ink-3">{t("hueNotSetUp")}</span>;
  }

  return (
    <>
      {status === null && <p className="mt-[18px] px-0.5 text-ink-2">{t(provider === "hue" ? "hueConnectBody" : "shellyConnectBody")}</p>}
      <SectionTitle>{t("connection")}</SectionTitle>
      <div className="rounded-[22px] bg-surface px-4">
        <ConnectionRow provider={provider} status={status} reload={reload} action={action} />
      </div>
      {provider === "shelly" && (
        <ShellySheet open={shellyOpen} onClose={() => setShellyOpen(false)} connected={status === "active"} host={data.shellyHost} devices={data.shellyDevices} reload={reload} />
      )}
    </>
  );
}

function ConnectionRow({ provider, status, action, reload }: { provider: LightProvider; status: ConnectionStatus; action: React.ReactNode; reload: () => Promise<void> }) {
  const t = useTranslations("lights");
  const { toast } = useUI();
  // Disconnecting cannot be undone from here (Hue needs a new consent), so it takes a second tap.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [armed]);

  const disconnect = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    try {
      const res = await disconnectLights({ provider });
      toast(res.ok ? t("disconnected", { provider: t(provider) }) : t("failed"));
      await reload();
    } catch {
      toast(t("failed"));
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t(provider)}</p>
        <p className={clsx("text-[13px]", status === "expired" ? "font-medium text-bad" : "text-ink-3")}>
          {t(status === "active" ? "connected" : status === "expired" ? "expired" : "notConnected")}
        </p>
      </div>
      {status !== null && (
        <button type="button" onClick={disconnect}
          className={clsx("press h-11 rounded-xl px-2 text-[13px] font-medium", armed ? "bg-bg text-bad" : "text-ink-3")}>
          {armed ? t("disconnectConfirm") : t("disconnect")}
        </button>
      )}
      {action}
    </div>
  );
}

function ShellySheet({ open, onClose, connected, host, devices, reload }: { open: boolean; onClose: () => void; connected: boolean; host: string | null; devices: ShellyDevice[]; reload: () => Promise<void> }) {
  const t = useTranslations("lights");
  const [changingKey, setChangingKey] = useState(false);
  const showConnect = !connected || changingKey;
  // Reload first: the device list must not show the old host while the new one is on its way.
  const saved = async () => {
    await reload();
    setChangingKey(false);
  };
  const close = () => {
    setChangingKey(false);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={t(showConnect ? "shellyConnectTitle" : "shellyDevices")}>
      {showConnect ? (
        <ShellyConnect initialHost={host ?? ""} reload={saved} onCancel={connected ? () => setChangingKey(false) : undefined} />
      ) : (
        <>
          <div className="mt-1 flex items-center gap-2 border-b border-line pb-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink-2">{t("host")}</p>
              <p className="truncate text-sm">{host}</p>
            </div>
            <button type="button" className={ROW_BUTTON} onClick={() => setChangingKey(true)}>{t("changeLink")}</button>
          </div>
          <ShellyDevices devices={devices} reload={reload} />
        </>
      )}
    </Sheet>
  );
}

function ShellyConnect({ initialHost, reload, onCancel }: { initialHost: string; reload: () => Promise<void>; onCancel?: () => void }) {
  const t = useTranslations("lights");
  const [host, setHost] = useState(initialHost);
  const [authKey, setAuthKey] = useState("");
  const [error, setError] = useState<"hostError" | "unavailable" | "failed" | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!normalizeShellyHost(host)) {
      setError("hostError");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await connectShelly({ host, authKey });
      if (res.ok) await reload();
      else setError(res.error === "invalid" ? "hostError" : res.error === "unavailable" ? "unavailable" : "failed");
    } catch {
      setError("failed");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="mt-1 flex flex-col gap-3">
      <p className="text-sm text-ink-2">{t("shellyConnectHelp")}</p>
      <Field label={t("host")} hint={t("hostHint")} value={host} onChange={(e) => setHost(e.target.value)}
        error={error === "hostError" ? t("hostError") : null} autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
      <Field label={t("authKey")} type="password" value={authKey} onChange={(e) => setAuthKey(e.target.value)} autoComplete="off" required />
      {error && error !== "hostError" && <p role="alert" className="text-sm font-medium text-bad">{t(error)}</p>}
      <PrimaryButton type="submit" disabled={busy}>{t("save")}</PrimaryButton>
      {onCancel && <button type="button" className={clsx(ROW_BUTTON, "w-full")} onClick={onCancel}>{t("cancel")}</button>}
    </form>
  );
}

function ShellyDevices({ devices, reload }: { devices: ShellyDevice[]; reload: () => Promise<void> }) {
  const t = useTranslations("lights");
  const { toast } = useUI();
  const [editingId, setEditingId] = useState<string | null>(null);
  // The device can disappear while editing (removed on the other phone): back to adding.
  const editing = devices.find((d) => d.id === editingId) ?? null;

  const remove = async (device: ShellyDevice) => {
    try {
      const res = await removeShelly({ id: device.id });
      if (!res.ok) toast(t("failed"));
      await reload();
    } catch {
      toast(t("failed"));
    }
  };

  return (
    <div className="mt-1">
      {devices.length === 0 && <p className="text-sm text-ink-3">{t("shellyNoDevices")}</p>}
      {devices.map((d) => (
        <div key={d.id} className="flex min-h-14 items-center gap-1 border-b border-line py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{d.name}</p>
            <p className="truncate text-[13px] text-ink-3">{d.room ?? t("noRoom")} · {d.deviceId} · {t("channelShort", { channel: d.channel })}</p>
          </div>
          <button type="button" onClick={() => setEditingId(d.id)} aria-label={t("editDevice", { name: d.name })}
            className="press grid h-11 w-11 flex-none place-items-center rounded-full text-ink-3">
            <PencilSimple size={18} />
          </button>
          <button type="button" onClick={() => remove(d)} aria-label={t("removeDevice", { name: d.name })}
            className="press grid h-11 w-11 flex-none place-items-center rounded-full text-ink-3">
            <Trash size={18} />
          </button>
        </div>
      ))}
      <DeviceForm key={editing?.id ?? "new"} device={editing} reload={reload} onDone={() => setEditingId(null)} />
    </div>
  );
}

function DeviceForm({ device, reload, onDone }: { device: ShellyDevice | null; reload: () => Promise<void>; onDone: () => void }) {
  const t = useTranslations("lights");
  const { toast } = useUI();
  const [deviceId, setDeviceId] = useState(device?.deviceId ?? "");
  const [channel, setChannel] = useState(String(device?.channel ?? 0));
  const [name, setName] = useState(device?.name ?? "");
  const [room, setRoom] = useState(device?.room ?? "");
  const [error, setError] = useState<"invalid" | "notFound" | "taken" | "failed" | "unavailable" | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  // The form sits below the list: with several devices the pencil would seem to do nothing.
  const editingId = device?.id;
  useEffect(() => {
    if (editingId) form.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [editingId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = { deviceId, channel: Number(channel), name, room };
      const res = await (device ? editShelly({ id: device.id, ...input }) : addShelly(input));
      if (res.ok) {
        toast(t(device ? "saved" : "added", { name: name.trim() }));
        if (!device) {
          setDeviceId("");
          setChannel("0");
          setName("");
        }
        await reload();
        onDone();
      } else {
        setError(res.error === "unauthorized" ? "failed" : res.error);
      }
    } catch {
      setError("failed");
    }
    setBusy(false);
  };

  return (
    <form ref={form} onSubmit={submit} className="mt-4 flex flex-col gap-3">
      <p className="text-[13px] font-semibold text-ink-3">{device ? t("editDevice", { name: device.name }) : t("shellyAddTitle")}</p>
      <Field label={t("name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
      <Field label={t("room")} value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} />
      <Field label={t("deviceId")} hint={t("deviceIdHint")} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
      <Field label={t("channel")} hint={t("channelHint")} type="number" inputMode="numeric" min={0} max={15} value={channel} onChange={(e) => setChannel(e.target.value)} required />
      {error && <p role="alert" className="text-sm font-medium text-bad">{t(error)}</p>}
      <PrimaryButton type="submit" disabled={busy}>
        {device ? t("save") : <><Plus size={18} /> {t("add")}</>}
      </PrimaryButton>
      {device && <button type="button" className={clsx(ROW_BUTTON, "w-full")} onClick={onDone}>{t("cancel")}</button>}
    </form>
  );
}
