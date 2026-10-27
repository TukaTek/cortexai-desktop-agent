// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAUS_COLOR_NAMES } from "@/lib/mascot";
import { MASCOT_BODY_IDS } from "../../shared/mascot-bodies";
import type { BotCreationDraft } from "@/lib/bot-creation-draft";

const fixture = vi.hoisted(() => ({ advanced: false, api: vi.fn(), create: vi.fn(), dispatch: vi.fn(), bots: [] as unknown[] }));
vi.mock("@/lib/interface-mode", () => ({ useAdvancedMode: () => fixture.advanced }));
vi.mock("@/lib/use-owner-or-admin", () => ({ useOwnerOrAdmin: () => false }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("./DesktopCapabilities", () => ({ useDesktopCapabilities: () => ({ capabilities: {} }) }));
vi.mock("@/lib/create-configured-bot", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/create-configured-bot")>(), createConfiguredBot: fixture.create,
}));
vi.mock("@/state/store", async (importOriginal) => {
  const store = await importOriginal<typeof import("@/state/store")>();
  return { ...store, api: fixture.api, BotEditorStore: () => null,
    useStore: () => ({ state: { ...store.initialState, bots: fixture.bots }, dispatch: fixture.dispatch }) };
});
const { LocalNewBotDialog } = await import("./NewBotDialog");
const { SWATCHES, freshLook } = await import("./QuickNewBot");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
const defaults = { defaults: { profile: {}, memory: {}, skills: [], routines: [] }, modelSelection: { instanceId: "claude", model: "sonnet" }, suggestedName: "Juniper" };

beforeEach(() => {
  fixture.advanced = false;
  fixture.bots = [];
  fixture.api.mockReset().mockResolvedValue(defaults);
  fixture.create.mockReset().mockImplementation(async (draft: BotCreationDraft) => ({ bot: { ...draft.bot, id: "created" }, warnings: [] }));
  fixture.dispatch.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

type DialogProps = NonNullable<Parameters<typeof LocalNewBotDialog>[0]>;
function Dialog(props: DialogProps) { return LocalNewBotDialog(props); }
async function open(props: DialogProps = {}) {
  await act(async () => root.render(createElement(Dialog, props)));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]')!;
const nameField = () => host.querySelector<HTMLInputElement>('input[placeholder="Name your bot"]')!;
const button = (label: string) => [...host.querySelectorAll("button")].find((candidate) =>
  (candidate.getAttribute("aria-label") ?? candidate.textContent?.trim()) === label)!;
const radio = (label: string) => host.querySelector<HTMLButtonElement>(`[role="radio"][aria-label="${label}"]`)!;
const checked = (group: string) => host.querySelector(`[role="radiogroup"][aria-label="${group}"] [aria-checked="true"]`)?.getAttribute("aria-label");
async function type(text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setValue.call(nameField(), text);
    nameField().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function press(target: Element, key: string) {
  await act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
async function click(target: HTMLElement) {
  await act(async () => target.click());
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe("creating a bot in Simple mode", () => {
  it("is one small dialog: a look, a name field with the cursor in it, the shapes and the colors", async () => {
    await open();
    expect(dialog().getAttribute("aria-label")).toBe("Create a bot");
    expect(document.activeElement).toBe(nameField());
    expect(nameField().value, "the person names their own bot").toBe("");
    expect([...host.querySelectorAll('[aria-label="Shape"] [role="radio"]')].map((node) => node.getAttribute("aria-label")))
      .toEqual(["Cursor", "Blob", "Circle", "Squircle", "Capsule", "Drop", "Shield", "Hexagon", "Diamond", "Star"]);
    expect(host.querySelectorAll('[aria-label="Color"] [role="radio"]')).toHaveLength(MAUS_COLOR_NAMES.length);
    expect(checked("Shape")).toBeTruthy();
    expect(checked("Color")).toBeTruthy();
    for (const section of ["Identity", "Soul", "Skills", "Memory", "Routines", "Permissions"]) expect(button(section)).toBeUndefined();
  });

  it("keeps Create off until the bot has a name", async () => {
    await open();
    expect(button("Create").disabled).toBe(true);
    await type("   ");
    expect(button("Create").disabled).toBe(true);
    await press(nameField(), "Enter");
    expect(fixture.create).not.toHaveBeenCalled();
    await type("Scout");
    expect(button("Create").disabled).toBe(false);
  });

  it("creates the bot in the shape and color chosen, on Enter, and lands in its chat", async () => {
    await open();
    await click(radio("Star"));
    await click(radio("Purple"));
    await type("Nova");
    await press(nameField(), "Enter");
    expect(fixture.create).toHaveBeenCalledOnce();
    expect(fixture.create.mock.calls[0]![0].bot).toMatchObject({ name: "Nova", color: "purple", mascotBody: "star" });
    expect(fixture.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "botAdded", preserveSelection: false }));
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "toggleNewBot", open: false });
  });

  it("moves the choice with the arrow keys and creates from a choice with Enter", async () => {
    await open();
    await type("Nova");
    await click(radio("Cursor"));
    await press(radio("Cursor"), "ArrowRight");
    expect(checked("Shape")).toBe("Blob");
    expect(document.activeElement).toBe(radio("Blob"));
    await press(radio("Blob"), "ArrowLeft");
    await press(radio("Cursor"), "ArrowLeft");
    expect(checked("Shape")).toBe("Star");
    await press(radio("Star"), "Enter");
    expect(fixture.create.mock.calls[0]![0].bot).toMatchObject({ name: "Nova", mascotBody: "star" });
  });

  it("opens the full dialog from More options with the name and look carried over", async () => {
    await open();
    await click(radio("Hexagon"));
    await click(radio("Teal"));
    await type("Scout");
    await click(button("More options"));
    expect(dialog().getAttribute("aria-label")).toBe("New Bot");
    for (const section of ["Identity", "Soul", "Skills", "Memory", "Routines", "Access", "Permissions", "Voice & alerts"]) expect(button(section)).toBeDefined();
    expect(button("Model"), "Simple mode picks no model: new bots use the default").toBeUndefined();
    await click(button("Create bot"));
    expect(fixture.create.mock.calls[0]![0].bot).toMatchObject({ name: "Scout", color: "teal", mascotBody: "hexagon" });
  });

  it("keeps the suggested name for the full dialog when none was typed", async () => {
    await open();
    await click(button("More options"));
    await click(button("Create bot"));
    expect(fixture.create.mock.calls[0]![0].bot.name).toBe("Juniper");
  });

  it("offers a name in one tap", async () => {
    fixture.bots = [{ name: "Ava", color: "green" }];
    await open();
    await click(button("Suggest a name"));
    expect(nameField().value).toMatch(/\S/);
    expect(nameField().value).not.toBe("Ava");
    expect(document.activeElement).toBe(nameField());
  });

  it("says it is creating while the new bot's defaults are still loading, then creates with what was typed", async () => {
    let load!: (value: typeof defaults) => void;
    fixture.api.mockReset().mockReturnValue(new Promise((resolve) => { load = resolve; }));
    await open();
    await click(radio("Drop"));
    await type("Scout");
    await press(nameField(), "Enter");
    expect(button("Creating…").disabled).toBe(true);
    expect(fixture.create).not.toHaveBeenCalled();
    await act(async () => load(defaults));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(fixture.create).toHaveBeenCalledOnce();
    expect(fixture.create.mock.calls[0]![0].bot).toMatchObject({ name: "Scout", mascotBody: "drop" });
  });

  it("says why it cannot create when the new bot's defaults fail to load, and keeps Create off", async () => {
    fixture.api.mockReset().mockRejectedValue(new Error("The app is not reachable"));
    await open();
    await type("Scout");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("The app is not reachable");
    expect(button("Create").disabled).toBe(true);
    await press(nameField(), "Enter");
    expect(button("Create")).toBeDefined();
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it("cancels with Escape, the close button or Cancel", async () => {
    for (const leave of [() => press(nameField(), "Escape"), () => click(button("Close")), () => click(button("Cancel"))]) {
      fixture.dispatch.mockReset();
      await open();
      await leave();
      expect(fixture.dispatch).toHaveBeenCalledWith({ type: "toggleNewBot", open: false });
      expect(fixture.create).not.toHaveBeenCalled();
      act(() => root.unmount());
      root = createRoot(host);
    }
  });

  it("starts a ready-made bot from its own name and look", async () => {
    await open({ readyBotId: "inbox" });
    expect(nameField().value).toBe("Inbox");
    expect(checked("Shape")).toBe("Squircle");
    expect(checked("Color")).toBe("Blue");
  });

  it("starts from the look saved in the defaults for new bots, unless the person has already picked one", async () => {
    const saved = { ...defaults, defaults: { ...defaults.defaults, profile: { color: "pink" as const, mascotBody: "shield" as const } } };
    fixture.api.mockReset().mockResolvedValue(saved);
    await open();
    expect(checked("Shape")).toBe("Shield");
    expect(checked("Color")).toBe("Pink");
    act(() => root.unmount());
    root = createRoot(host);
    let load!: (value: typeof saved) => void;
    fixture.api.mockReset().mockReturnValue(new Promise((resolve) => { load = resolve; }));
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      await open();
    } finally {
      random.mockRestore();
    }
    expect([checked("Shape"), checked("Color")]).toEqual(["Cursor", "Red"]);
    await click(radio("Cursor"));
    await click(radio("Red"));
    await act(async () => load(saved));
    expect([checked("Shape"), checked("Color")], "picking the look already shown is still a choice").toEqual(["Cursor", "Red"]);
  });
});

describe("creating a bot in Advanced mode", () => {
  it("opens the full dialog, as before", async () => {
    fixture.advanced = true;
    await open();
    expect(dialog().getAttribute("aria-label")).toBe("New Bot");
    expect(button("Model")).toBeDefined();
    expect(nameField()).toBeNull();
  });
});

describe("a new bot's first look", () => {
  it("lists every color once, in hue order with the metals last", () => {
    expect([...SWATCHES].sort()).toEqual([...MAUS_COLOR_NAMES].sort());
    expect(SWATCHES.slice(-2)).toEqual(["silver", "chrome"]);
  });

  it("is random, prefers a color and a shape no bot wears yet, and never starts as a metal, a capsule or a shield", () => {
    const worn = [{ color: "red" as const, mascotBody: "cursor" as const }, { color: "coral" as const, mascotBody: "blob" as const }];
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
      const look = freshLook(worn, () => roll);
      expect(["red", "coral", "silver", "chrome"]).not.toContain(look.color);
      expect(["cursor", "blob", "capsule", "shield"]).not.toContain(look.mascotBody);
    }
    expect(freshLook([], () => 0)).not.toEqual(freshLook([], () => 0.999));
    const everyone = MASCOT_BODY_IDS.map((mascotBody) => ({ color: "green" as const, mascotBody }));
    for (const roll of [0, 0.5, 0.999]) expect(["capsule", "shield"]).not.toContain(freshLook(everyone, () => roll).mascotBody);
  });
});
