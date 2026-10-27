import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Dice5, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { MAUS_COLOR_LABEL, colorSwatch, type MausColor } from "@/lib/mascot";
import { randomBotName } from "@/lib/random-bot-name";
import { BOT_PROFILE_LIMITS } from "../../shared/bot-profile";
import type { BotBodyId } from "../../shared/bot-body";
import { MASCOT_BODIES, MASCOT_BODY_IDS, type MascotBodyId } from "../../shared/mascot-bodies";
import { MausAvatar } from "./Avatar";
import { VIEW_BOX } from "./CursorAvatar";

export interface QuickBotChoice {
  name: string;
  color: MausColor;
  mascotBody: BotBodyId;
}

export const SWATCHES: readonly MausColor[] = [
  "red", "coral", "orange", "yellow", "green", "teal",
  "cyan", "blue", "purple", "pink", "silver", "chrome",
];
const SHAPE_SIZE = 42;
const RING_GAP = 3;
const RING_WIDTH = 1;
const LIVELY = SWATCHES.filter((color) => color !== "silver" && color !== "chrome");
const STARTER_SHAPES: readonly MascotBodyId[] = ["cursor", "blob", "circle", "squircle", "drop", "hexagon", "diamond", "star"];

export function freshLook(
  bots: ReadonlyArray<{ color: MausColor; mascotBody?: BotBodyId | null }>,
  random: () => number = Math.random,
): Pick<QuickBotChoice, "color" | "mascotBody"> {
  const pick = <T,>(all: readonly T[], worn: readonly T[]): T => {
    const unworn = all.filter((item) => !worn.includes(item));
    const pool = unworn.length ? unworn : all;
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
  };
  return {
    color: pick(LIVELY, bots.map((bot) => bot.color)),
    mascotBody: pick<BotBodyId>(STARTER_SHAPES, bots.map((bot) => bot.mascotBody ?? "cursor")),
  };
}

export function QuickNewBot({ value, onChange, takenNames, busy, canCreate, error, note, onCancel, onCreate, onMore }: {
  value: QuickBotChoice;
  onChange: (value: QuickBotChoice, picked: "name" | "look") => void;
  takenNames: readonly string[];
  busy: boolean;
  canCreate: boolean;
  error: string;
  note?: ReactNode;
  onCancel: () => void;
  onCreate: (value: QuickBotChoice) => void;
  onMore: (value: QuickBotChoice) => void;
}) {
  const [reacted, setReacted] = useState(0);
  const nameField = useRef<HTMLInputElement>(null);
  const named = value.name.trim().length > 0;
  const restyle = (look: Partial<QuickBotChoice>) => {
    onChange({ ...value, ...look }, "look");
    setReacted((count) => count + 1);
  };
  const suggest = () => {
    onChange({ ...value, name: randomBotName(Math.random() < 0.5 ? "female" : "male", value.name, [...takenNames]) }, "name");
    nameField.current?.focus();
  };
  const create = () => { if (named && !busy && canCreate) onCreate(value); };

  return <>
    <div className="flex shrink-0 items-center justify-between border-b-[0.5px] border-hairline py-3 pl-4 pr-3">
      <h2 className="truncate text-[14px] font-semibold leading-[22px] text-ink">{t("newBot.quick.title")}</h2>
      <button type="button" onClick={onCancel} aria-label={t("common.close")}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-raised hover:text-ink">
        <X size={16} strokeWidth={1.75} className="pointer-events-none" />
      </button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
      <div className="flex justify-center py-1">
        <MausAvatar color={value.color} bodyId={value.mascotBody} size={120} state={named ? "happy" : "idle"}
          motion={reacted ? "customize" : "none"} motionKey={reacted} />
      </div>
      <div className="relative">
        <input ref={nameField} data-autofocus value={value.name} readOnly={busy} maxLength={BOT_PROFILE_LIMITS.name}
          placeholder={t("newBot.quick.namePlaceholder")} aria-label={t("newBot.quick.namePlaceholder")}
          onChange={(event) => onChange({ ...value, name: event.target.value }, "name")}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            create();
          }}
          className={cn("h-9 w-full rounded-[8px] border border-hairline/70 bg-transparent px-10 text-center text-[14px] text-ink placeholder:text-ink-tertiary", !value.name && "caret-transparent")} />
        <button type="button" onClick={suggest} disabled={busy} aria-label={t("newBot.quick.suggestName")} title={t("newBot.quick.suggestName")}
          className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-tertiary hover:bg-raised hover:text-ink disabled:opacity-50">
          <Dice5 size={16} strokeWidth={1.75} className="pointer-events-none" />
        </button>
      </div>
      {note}
      <Choices label={t("newBot.quick.shape")} className="mt-6 grid-cols-5 gap-3" options={MASCOT_BODY_IDS} chosen={value.mascotBody}
        disabled={busy} onChoose={(mascotBody) => restyle({ mascotBody })} onEnter={create}
        render={(id, chosen) => <ShapeChoice id={id} color={value.color} chosen={chosen} />}
        labelOf={(id) => MASCOT_BODIES[id].name}
        buttonClass="relative flex size-11 items-center justify-center rounded-full motion-safe:transition-transform motion-safe:enabled:hover:scale-105" />
      <Choices label={t("newBot.quick.color")} className="mt-7 grid-cols-6 gap-2.5" options={SWATCHES} chosen={value.color}
        disabled={busy} onChoose={(color) => restyle({ color })} onEnter={create}
        render={(color, chosen) => <span aria-hidden="true" className={cn("block size-7 rounded-full", chosen && "outline outline-1 outline-offset-[3px] outline-ink/25")}
          style={{ background: colorSwatch(color) }} />}
        labelOf={(color) => t(MAUS_COLOR_LABEL[color])}
        buttonClass="flex rounded-full motion-safe:transition-transform motion-safe:enabled:hover:scale-110" />
    </div>
    {error && <p role="alert" className="max-h-24 shrink-0 overflow-y-auto px-4 pb-3 text-center text-[13px] text-danger">{error}</p>}
    <div className="flex shrink-0 items-center gap-2 border-t-[0.5px] border-hairline py-3 pl-4 pr-3">
      <button type="button" onClick={() => onMore(value)} disabled={busy}
        className="mr-auto truncate rounded-md text-[13px] text-ink-tertiary hover:text-ink disabled:opacity-50">{t("newBot.quick.more")}</button>
      <button type="button" onClick={onCancel} disabled={busy}
        className="h-8 shrink-0 rounded-full border border-hairline px-3 text-[14px] text-ink hover:bg-raised disabled:opacity-50">{t("common.cancel")}</button>
      <button type="button" onClick={create} disabled={!named || busy || !canCreate}
        className="h-8 shrink-0 rounded-full bg-ink px-3 text-[14px] text-app hover:opacity-90 disabled:bg-raised disabled:text-ink-tertiary disabled:hover:opacity-100">
        {busy ? t("newBot.quick.creating") : t("newBot.quick.create")}
      </button>
    </div>
  </>;
}

function Choices<T extends string>({ label, className, options, chosen, disabled, onChoose, onEnter, render, labelOf, buttonClass }: {
  label: string;
  className: string;
  options: readonly T[];
  chosen: string;
  disabled: boolean;
  onChoose: (option: T) => void;
  onEnter: () => void;
  render: (option: T, chosen: boolean) => ReactNode;
  labelOf: (option: T) => string;
  buttonClass: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const tabbable = options.includes(chosen as T) ? chosen : options[0];
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onEnter();
      return;
    }
    const at = options.indexOf(chosen as T);
    const back = Math.max(at, 0) - 1;
    const next = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: back, ArrowUp: back, Home: 0, End: options.length - 1 }[event.key];
    if (next === undefined || disabled) return;
    event.preventDefault();
    const index = (next + options.length) % options.length;
    onChoose(options[index]!);
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus();
  };
  return <div ref={group} role="radiogroup" aria-label={label} onKeyDown={step} className={cn("mx-auto grid w-fit", className)}>
    {options.map((option) => <button key={option} type="button" role="radio" aria-checked={option === chosen} aria-label={labelOf(option)}
      tabIndex={option === tabbable ? 0 : -1} disabled={disabled} onClick={() => onChoose(option)} className={buttonClass}>
      {render(option, option === chosen)}
    </button>)}
  </div>;
}

function ShapeChoice({ id, color, chosen }: { id: MascotBodyId; color: MausColor; chosen: boolean }) {
  return <>
    {chosen && <svg viewBox={VIEW_BOX} width={SHAPE_SIZE} height={SHAPE_SIZE} aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible text-ink/25">
      <g transform={MASCOT_BODIES[id].fit} fill="none" strokeLinejoin="round" className="[&_path]:[vector-effect:non-scaling-stroke]">
        <g stroke="currentColor" strokeWidth={2 * (RING_GAP + RING_WIDTH)} dangerouslySetInnerHTML={{ __html: MASCOT_BODIES[id].clip }} />
        <g stroke="var(--color-menu)" strokeWidth={2 * RING_GAP} dangerouslySetInnerHTML={{ __html: MASCOT_BODIES[id].clip }} />
      </g>
    </svg>}
    <span className="relative flex"><MausAvatar color={color} bodyId={id} size={SHAPE_SIZE} animated={false} trackPointer={false} /></span>
  </>;
}
