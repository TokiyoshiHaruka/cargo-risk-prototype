import {
  buildReceipt,
  createInitialState,
  resolveEvent,
  restartRun,
  selectContract,
  selectRoute,
  settleRun,
  toggleEscort,
  type SimulationState,
} from "./simulation";
import type { CargoScene } from "./game";

function button(label: string, action: string, disabled = false): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.dataset.action = action;
  element.textContent = label;
  element.disabled = disabled;
  return element;
}

function detail(text: string, strongText: string): HTMLElement {
  const wrapper = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = strongText;
  const span = document.createElement("span");
  span.textContent = text;
  wrapper.append(strong, span);
  return wrapper;
}

export function createHud(root: HTMLElement, initial: SimulationState, scene: CargoScene): void {
  let state = initial;
  let receiptOpen = false;

  const render = (): void => {
    root.replaceChildren();
    const status = document.createElement("section");
    status.className = "hud-status";
    const statusKicker = document.createElement("p");
    statusKicker.className = "hud-kicker";
    statusKicker.textContent = `RUN ${state.seed.toString(16).toUpperCase().padStart(4, "0")}`;
    const metrics = document.createElement("div");
    metrics.className = "hud-metrics";
    [[state.credits, "CR"], [`${state.cargo.units}/${state.cargo.maxUnits}`, "CARGO"], [state.reputation, "REP"]].forEach(([value, label]) => {
      const metric = document.createElement("span");
      const strong = document.createElement("b");
      strong.textContent = String(value);
      metric.append(strong, document.createTextNode(` ${label}`));
      metrics.appendChild(metric);
    });
    status.append(statusKicker, metrics);
    root.appendChild(status);

    const panel = document.createElement("section");
    panel.className = "hud-panel";
    const title = document.createElement("h1");
    title.textContent = state.phase === "contract" ? "Choose a contract" : state.phase === "route" ? "Plot the run" : state.phase === "event" ? "Route event" : "Run complete";
    panel.appendChild(title);

    if (state.phase === "contract") {
      const list = document.createElement("div");
      list.className = "choice-list";
      state.contracts.forEach((contract) => {
        const card = document.createElement("article");
        card.className = "choice-card";
        card.appendChild(detail(`${contract.cargoUnits} cargo / ${contract.buyCost} CR cost / ${contract.payout} CR base payout`, contract.name));
        card.appendChild(button("Accept", `contract:${contract.id}`, contract.buyCost > state.credits));
        list.appendChild(card);
      });
      panel.appendChild(list);
    } else if (state.phase === "route") {
      const list = document.createElement("div");
      list.className = "choice-list";
      state.routes.forEach((route) => {
        const card = document.createElement("article");
        card.className = "choice-card route-card";
        card.appendChild(detail(`${Math.round(route.risk * 100)}% risk / ${route.fuelCost} CR fuel / x${route.multiplier.toFixed(2)} payout`, route.name));
        card.appendChild(button("Lock route", `route:${route.id}`, route.fuelCost > state.credits));
        list.appendChild(card);
      });
      const escort = button(state.escort ? "Escort armed | 70 CR" : "Add escort | 70 CR", "escort");
      escort.className = state.escort ? "secondary active" : "secondary";
      panel.append(list, escort);
    } else if (state.phase === "event") {
      const eventNote = document.createElement("p");
      eventNote.className = "event-note";
      eventNote.textContent = state.events.length ? state.events[state.events.length - 1].message : "Two deterministic events stand between the hold and the destination.";
      panel.appendChild(eventNote);
      const eventActions = document.createElement("div");
      eventActions.className = "event-actions";
      eventActions.append(
        button(state.events.length === 0 ? "Hold course" : "Hold course again", "event:hold"),
        button("Evasive maneuver | 12 CR", "event:evade"),
      );
      panel.appendChild(eventActions);
    } else {
      const receipt = buildReceipt(state);
      const result = document.createElement("p");
      result.className = `result result-${receipt?.outcome ?? "loss"}`;
      result.textContent = receipt ? `${receipt.outcome.toUpperCase()} | ${receipt.profit >= 0 ? "+" : ""}${receipt.profit} CR` : "No receipt";
      panel.appendChild(result);
      panel.appendChild(button(receiptOpen ? "Hide run receipt" : "Inspect run receipt", "receipt"));
      panel.appendChild(button("Restart with new seed", "restart"));
      if (receiptOpen && receipt) panel.appendChild(receiptElement(receipt));
    }
    root.appendChild(panel);

    const log = document.createElement("ol");
    log.className = "event-log";
    state.log.slice(-4).forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = entry;
      log.appendChild(item);
    });
    root.appendChild(log);
    root.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((control) => {
      control.addEventListener("click", () => dispatch(control.dataset.action ?? ""));
    });
    scene.setState(state);
  };

  const receiptElement = (receipt: NonNullable<ReturnType<typeof buildReceipt>>): HTMLElement => {
    const element = document.createElement("div");
    element.className = "receipt";
    const heading = document.createElement("h2");
    heading.textContent = "Run receipt";
    const contract = state.contracts.find((entry) => entry.id === receipt.contractId);
    const route = state.routes.find((entry) => entry.id === receipt.routeId);
    const body = document.createElement("p");
    body.textContent = [
      `Seed ${receipt.seed}`,
      `contract ${contract?.name ?? receipt.contractId}`,
      `route ${route?.name ?? receipt.routeId}`,
      `choices ${receipt.events.map((event) => event.choice).join(", ")}`,
      `rolls ${receipt.events.map((event) => event.roll.toFixed(4)).join(", ")}`,
      `credits ${receipt.startingCredits} -> ${receipt.endingCredits}`,
      `cargo ${receipt.cargoEnd}/${receipt.cargoStart}`,
      `profit ${receipt.profit >= 0 ? "+" : ""}${receipt.profit} CR`,
      `reputation ${receipt.reputationDelta >= 0 ? "+" : ""}${receipt.reputationDelta}`,
    ].join(" | ");
    element.append(heading, body);
    return element;
  };

  const dispatch = (action: string): void => {
    const [kind, value] = action.split(":");
    if (kind === "contract" && value) state = selectContract(state, value);
    if (kind === "route" && value) state = selectRoute(state, value);
    if (kind === "escort") state = toggleEscort(state);
    if (kind === "event") {
      state = resolveEvent(state, value === "evade" ? "evade" : "hold");
      if (state.phase === "settlement") state = settleRun(state);
    }
    if (kind === "receipt") receiptOpen = !receiptOpen;
    if (kind === "restart") state = restartRun(Math.floor(Math.random() * 1_000_000));
    render();
  };

  render();
}
