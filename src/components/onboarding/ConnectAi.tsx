import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { EngineSetup } from "@/components/EngineSetup";
import { engineReady } from "@/components/EngineLibrary";
import { InstanceProviderMark } from "@/components/ProviderIcons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { aiChoices, organisationSignIn, plainSignIn } from "@/lib/onboarding";
import { api, useStore, type InstanceInfo } from "@/state/store";
import { OrganisationRow } from "./beats/OrganisationRow";

/** A local-model setup and a step finished in Terminal keep their own words; every other sign-in says the same plain line
 * instead of the setup's technical one. */
function setupFor(instance: InstanceInfo) {
  if (instance.access === "custom") return { intent: "inject" as const };
  return plainSignIn(instance)
    ? { intent: "cloud" as const, description: t("onboarding.engines.signInHint", { name: instance.displayName }) }
    : { intent: "cloud" as const };
}

function OtherWay({ instance, open, onToggle }: { instance: InstanceInfo; open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-ink/[0.04] focus-visible:outline-offset-[-2px]"
      >
        <span className="flex size-[18px] shrink-0 items-center justify-center">
          <InstanceProviderMark instance={instance} size={18} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{instance.displayName}</span>
        <ChevronDown size={14} className={cn("shrink-0 text-ink-secondary transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <EngineSetup instance={instance} {...setupFor(instance)} className="mx-4 mb-3.5 border-0 bg-inset" />}
    </div>
  );
}

/** The first screen's one required action when no AI works yet: the recommended way to connect one, every other way
 * folded under it. */
export function ConnectAi({ hosted = false }: { hosted?: boolean }) {
  const { state, dispatch } = useStore();
  const organisation = organisationSignIn(window.ogb, { hosted });
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    setChecking(true);
    try {
      const d = await api("/api/instances", { signal: AbortSignal.timeout(10_000) });
      if (request !== latestRequest.current) return;
      dispatch({ type: "instances", instances: d.instances ?? [] });
      setFailed(false);
    } catch {
      if (request === latestRequest.current) setFailed(true);
    } finally {
      if (request === latestRequest.current) setChecking(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void refresh();
    return () => {
      latestRequest.current++;
    };
  }, [refresh]);

  const connected = state.instances.find(engineReady);
  const { recommended, others } = aiChoices(state.instances.filter((instance) => instance.install && !engineReady(instance)));

  return (
    <section aria-labelledby="connect-ai-title" className="flex w-full flex-col items-center">
      <h2 id="connect-ai-title" className="text-center text-[15px] text-ink-secondary">{t("onboarding.meet.connect")}</h2>

      {connected ? (
        <p role="status" data-ai-connected className="animate-rise mt-3 flex items-center gap-2 text-[14px] text-success">
          <Check size={15} strokeWidth={2.5} aria-hidden="true" />
          {t("onboarding.engines.connected", { name: connected.displayName })}
        </p>
      ) : recommended ? (
        <div data-ai-recommended={recommended.instanceId} className="animate-rise mt-3 w-full rounded-2xl bg-card p-4 text-left">
          <EngineSetup instance={recommended} {...setupFor(recommended)} className="border-0 bg-transparent p-0" />
        </div>
      ) : !failed ? (
        <p className="mt-3 text-[13px] text-ink-secondary" aria-live="polite">{t("common.checking")}</p>
      ) : null}
      {failed && <p role="alert" className="mt-2 text-[13px] text-danger">{t("onboarding.engines.error")}</p>}

      {!connected && (organisation || others.length > 0) && (
        <div className="mt-2 flex w-full flex-col items-center">
          <button
            type="button"
            onClick={() => setMore((value) => !value)}
            aria-expanded={more}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] text-ink-secondary transition-colors hover:text-ink"
          >
            {t("onboarding.engines.otherWays")}
            <ChevronDown size={14} aria-hidden="true" className={cn("shrink-0 transition-transform duration-200", more && "rotate-180")} />
          </button>
          {more && (
            <div className="animate-rise mt-1 w-full divide-y divide-hairline/40 overflow-hidden rounded-2xl bg-card text-left">
              {organisation && (
                <OrganisationRow
                  bridge={organisation}
                  onOpenSettings={() => dispatch({ type: "toggleAppSettings", open: true, section: "organization" })}
                  onConnected={() => void refresh()}
                />
              )}
              {others.map((instance) => (
                <OtherWay key={instance.instanceId} instance={instance} open={open === instance.instanceId}
                  onToggle={() => setOpen(open === instance.instanceId ? null : instance.instanceId)} />
              ))}
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={checking}
                className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-[12px] text-ink-secondary transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-offset-[-2px] disabled:opacity-50"
              >
                <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
                {checking ? t("common.checking") : t("common.checkAgain")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
