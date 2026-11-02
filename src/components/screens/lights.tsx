"use client";

import { ArrowClockwise, CaretLeft, Lightbulb, Plus, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { addShelly, changeLight, connectShelly, disconnectLights, getLights, removeShelly, startHueLink } from "@/app/actions/lights";
import { doneVariant } from "@/lib/bank-callback";
import { groupByRoom, normalizeShellyHost, type ConnectionStatus, type Light, type LightChange, type LightProvider, type LightsOverview } from "@/lib/lights";
import { Field, PrimaryButton } from "../form";
import { PageHeader, Screen, SectionTitle } from "../screen";
import { Sheet } from "../sheet";
import { useUI } from "../ui-provider";

/** Wait before sending a slider value. Shelly allows one call per second per account. */
const SLIDER_WAIT_MS: Record<LightProvider, number> = { hue: 400, shelly: 1100 };

const ROW_BUTTON = "press h-11 flex-none rounded-xl bg-bg px-3 text-[13px] font-semibold disabled:opacity-40";

type Loaded = { status: "loading" } | { status: "ready"; data: LightsOverview } | { status: "error"; reason: "unavailable" | "failed" };

export function LightsScreen() {
  return (
    <Screen>
      <Lights />
    </Screen>
  );
}

function Lights() {
  const t = useTranslations("lights");
  const { toast } = useUI();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await getLights();
      if (res.ok) setLoaded({ status: "ready", data: res });
      else setLoaded({ status: "error", reason: res.error === "unavailable" ? "unavailable" : "failed" });
    } catch {
      setLoaded({ status: "error", reason: "failed" });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    getLights()
      .then((res) => {
        if (!alive) return;
        if (res.ok) setLoaded({ status: "ready", data: res });
        else setLoaded({ status: "error", reason: res.error === "unavailable" ? "unavailable" : "failed" });
      })
      .catch(() => alive && setLoaded({ status: "error", reason: "failed" }));
    return () => {
      alive = false;
    };
  }, []);

  // Result of the Hue redirect (/huis/lampen?hue=<outcome>): one toast, then a clean URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("hue");
    if (result === null) return;
    const v = doneVariant(result);
    toast(t(v === "linked" ? "hueLinked" : v === "cancelled" ? "hueCancelled" : "hueFailed"));
    window.history.replaceState(null, "", window.location.pathname);
  }, [t, toast]);

  /** Shows the change at once; on failure the real state comes back from the vendor. */
  const change = async (light: Light, patch: LightChange) => {
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

  return (
    <>
      <Link href="/" transitionTypes={["nav-back"]} className="press -ml-2 mb-2 inline-flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-ink-2">
        <CaretLeft size={18} /> {t("back")}
      </Link>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")}
        action={
          <button type="button" onClick={load} disabled={refreshing} aria-label={t("refresh")}
            className="press grid h-11 w-11 place-items-center rounded-full bg-surface">
            <ArrowClockwise size={18} className={clsx(refreshing && "animate-spin")} />
          </button>
        } />

      {loaded.status === "loading" && (
        <div aria-hidden="true" className="mt-[18px] flex flex-col gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-[22px]" />)}
        </div>
      )}

      {loaded.status === "error" && (
        <div className="mt-[18px] rounded-[22px] bg-surface p-4 text-sm">
          <p>{t(loaded.reason)}</p>
          {loaded.reason === "failed" && <button type="button" className={clsx(ROW_BUTTON, "mt-3 w-full")} onClick={load}>{t("retry")}</button>}
        </div>
      )}

      {loaded.status === "ready" && (
        <>
          {loaded.data.problems.map((p) => (
            <p key={p} role="status" className="mt-3 px-1 text-[13px] font-medium text-bad">{t("unreachable", { provider: t(p) })}</p>
          ))}
          {loaded.data.lights.length === 0 ? (
            <p className="mt-[18px] rounded-[22px] bg-surface p-5 text-center text-ink-3">{t("empty")}</p>
          ) : (
            groupByRoom(loaded.data.lights).map((group) => (
              <section key={group.room ?? ""}>
                <SectionTitle>{group.room ?? t("noRoom")}</SectionTitle>
                <div className="rounded-[22px] bg-surface px-4">
                  {group.lights.map((light) => <LightRow key={light.id} light={light} onChange={(patch) => change(light, patch)} />)}
                </div>
              </section>
            ))
          )}
          <Connections data={loaded.data} reload={load} />
        </>
      )}
    </>
  );
}

function LightRow({ light, onChange }: { light: Light; onChange: (patch: LightChange) => void }) {
  const t = useTranslations("lights");
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const slide = (value: number) => {
    setDraft(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setDraft(null);
      onChange({ brightness: value });
    }, SLIDER_WAIT_MS[light.provider]);
  };

  return (
    <div className="border-b border-line py-2 last:border-b-0">
      <div className="flex min-h-11 items-center gap-3">
        <Lightbulb size={20} weight={light.on ? "fill" : "regular"} className={clsx("flex-none", light.on ? "text-accent" : "text-ink-3")} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{light.name}</p>
          {!light.online && <p className="text-[13px] text-ink-3">{t("offline")}</p>}
        </div>
        <button type="button" role="switch" aria-checked={light.on} aria-label={t("toggle", { name: light.name })} disabled={!light.online}
          onClick={() => onChange({ on: !light.on })} className="press grid h-11 w-14 flex-none place-items-center disabled:opacity-40">
          <span className={clsx("relative h-7 w-12 rounded-full transition-colors duration-200", light.on ? "bg-accent-strong" : "bg-line")}>
            <span className={clsx("absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white transition-transform duration-200", light.on && "translate-x-5")} />
          </span>
        </button>
      </div>
      {light.on && light.online && light.brightness !== null && (
        <input type="range" min={1} max={100} value={draft ?? light.brightness} aria-label={t("brightness", { name: light.name })}
          onChange={(e) => slide(Number(e.target.value))} className="h-11 w-full accent-[var(--accent-strong)]" />
      )}
    </div>
  );
}

function Connections({ data, reload }: { data: LightsOverview; reload: () => Promise<void> }) {
  const t = useTranslations("lights");
  const { toast } = useUI();
  const [shellyOpen, setShellyOpen] = useState(false);
  const [going, setGoing] = useState(false);

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

  const shellyLights = data.lights.filter((l) => l.provider === "shelly");

  return (
    <>
      <SectionTitle>{t("connections")}</SectionTitle>
      <div className="rounded-[22px] bg-surface px-4">
        <ConnectionRow provider="hue" status={data.connections.hue} reload={reload}
          action={
            data.connections.hue === "active" ? null : data.hueAvailable ? (
              <button type="button" className={ROW_BUTTON} disabled={going} onClick={linkHue}>
                {t(data.connections.hue === "expired" ? "reconnect" : "connect")}
              </button>
            ) : (
              <span className="text-right text-[13px] text-ink-3">{t("hueNotSetUp")}</span>
            )
          } />
        <ConnectionRow provider="shelly" status={data.connections.shelly} reload={reload}
          action={
            <button type="button" className={ROW_BUTTON} onClick={() => setShellyOpen(true)}>
              {t(data.connections.shelly === "active" ? "manage" : data.connections.shelly === "expired" ? "reconnect" : "connect")}
            </button>
          } />
      </div>
      <ShellySheet open={shellyOpen} onClose={() => setShellyOpen(false)} connected={data.connections.shelly === "active"} devices={shellyLights} reload={reload} />
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

function ShellySheet({ open, onClose, connected, devices, reload }: { open: boolean; onClose: () => void; connected: boolean; devices: Light[]; reload: () => Promise<void> }) {
  const t = useTranslations("lights");
  return (
    <Sheet open={open} onClose={onClose} title={t(connected ? "shellyDevices" : "shellyConnectTitle")}>
      {connected ? <ShellyDevices devices={devices} reload={reload} /> : <ShellyConnect reload={reload} />}
    </Sheet>
  );
}

function ShellyConnect({ reload }: { reload: () => Promise<void> }) {
  const t = useTranslations("lights");
  const [host, setHost] = useState("");
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
    </form>
  );
}

function ShellyDevices({ devices, reload }: { devices: Light[]; reload: () => Promise<void> }) {
  const t = useTranslations("lights");
  const { toast } = useUI();
  const [deviceId, setDeviceId] = useState("");
  const [channel, setChannel] = useState("0");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [error, setError] = useState<"invalid" | "notFound" | "failed" | "unavailable" | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await addShelly({ deviceId, channel: Number(channel), name, room });
      if (res.ok) {
        toast(t("added", { name: name.trim() }));
        setDeviceId("");
        setChannel("0");
        setName("");
        await reload();
      } else {
        setError(res.error === "unauthorized" ? "failed" : res.error);
      }
    } catch {
      setError("failed");
    }
    setBusy(false);
  };

  const remove = async (light: Light) => {
    try {
      const res = await removeShelly({ id: light.id.slice("shelly:".length) });
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
        <div key={d.id} className="flex min-h-12 items-center gap-2 border-b border-line">
          <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
          <button type="button" onClick={() => remove(d)} aria-label={t("removeDevice", { name: d.name })}
            className="press grid h-11 w-11 place-items-center rounded-full text-ink-3">
            <Trash size={18} />
          </button>
        </div>
      ))}
      <form onSubmit={add} className="mt-4 flex flex-col gap-3">
        <p className="text-[13px] font-semibold text-ink-3">{t("shellyAddTitle")}</p>
        <Field label={t("name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        <Field label={t("room")} value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} />
        <Field label={t("deviceId")} hint={t("deviceIdHint")} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
        <Field label={t("channel")} hint={t("channelHint")} type="number" inputMode="numeric" min={0} max={15} value={channel} onChange={(e) => setChannel(e.target.value)} required />
        {error && <p role="alert" className="text-sm font-medium text-bad">{t(error)}</p>}
        <PrimaryButton type="submit" disabled={busy}><Plus size={18} /> {t("add")}</PrimaryButton>
      </form>
    </div>
  );
}
