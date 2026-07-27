import { describe, expect, it } from "vitest";

import {
  createInitialState,
  resolveEvent,
  restartRun,
  selectContract,
  selectRoute,
  settleRun,
  toggleEscort,
} from "../src/simulation";

describe("cargo risk simulation", () => {
  it("creates a deterministic initial state for a seed", () => {
    const first = createInitialState(42);
    const second = createInitialState(42);
    expect(first).toEqual(second);
    expect(first.phase).toBe("contract");
    expect(first.credits).toBeGreaterThan(0);
  });

  it("replays the same contract and route actions into the same receipt", () => {
    const play = () => {
      let state = createInitialState(7);
      state = selectContract(state, "reactor-parts");
      state = toggleEscort(state);
      state = selectRoute(state, "blackwater");
      state = resolveEvent(state);
      state = resolveEvent(state);
      return settleRun(state);
    };
    expect(play()).toEqual(play());
    expect(play()?.events).toHaveLength(2);
  });

  it("moves from contract selection to route selection without mutating the source", () => {
    const initial = createInitialState(10);
    const selected = selectContract(initial, "med-supplies");
    expect(initial.phase).toBe("contract");
    expect(selected.phase).toBe("route");
    expect(selected.selectedContractId).toBe("med-supplies");
    expect(selected.cargo.units).toBe(3);
    expect(selected.credits).toBe(820);
  });

  it("charges escort only at settlement and keeps cargo loss bounded", () => {
    let state = createInitialState(2);
    state = selectContract(state, "survey-drones");
    state = toggleEscort(state);
    state = selectRoute(state, "blackwater");
    expect(state.credits).toBe(855);
    state = resolveEvent(state);
    state = resolveEvent(state);
    state = settleRun(state);
    expect(state.receipt?.escortUsed).toBe(true);
    expect(state.cargo.units).toBeGreaterThanOrEqual(0);
    expect(state.cargo.units).toBeLessThanOrEqual(state.cargo.maxUnits);
    expect(state.credits).toBeGreaterThanOrEqual(0);
  });

  it("restart clears the previous receipt and accepts a new seed", () => {
    let state = createInitialState(12);
    state = selectContract(state, "survey-drones");
    state = selectRoute(state, "lantern");
    state = resolveEvent(resolveEvent(state));
    state = settleRun(state);
    expect(state.receipt).not.toBeNull();
    const restarted = restartRun(99);
    expect(restarted.seed).toBe(99);
    expect(restarted.phase).toBe("contract");
    expect(restarted.receipt).toBeNull();
  });

  it("receipt exposes the fields needed to explain a result", () => {
    let state = createInitialState(42);
    state = selectContract(state, "reactor-parts");
    state = selectRoute(state, "long-haul");
    state = resolveEvent(state);
    state = resolveEvent(state);
    state = settleRun(state);
    expect(state.receipt).toMatchObject({
      seed: 42,
      contractId: "reactor-parts",
      routeId: "long-haul",
      startingCredits: 1000,
      cargoStart: 5,
    });
    expect(state.receipt?.profit).toEqual(state.receipt!.endingCredits - state.receipt!.startingCredits);
  });
});
