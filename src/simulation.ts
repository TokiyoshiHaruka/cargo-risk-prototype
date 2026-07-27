export type Phase = "contract" | "route" | "event" | "settlement";
export type EventChoice = "hold" | "evade";

export interface Contract {
  id: string;
  name: string;
  cargoUnits: number;
  buyCost: number;
  payout: number;
  reputation: number;
}

export interface Route {
  id: string;
  name: string;
  risk: number;
  fuelCost: number;
  multiplier: number;
}

export interface CargoState {
  id: string;
  units: number;
  maxUnits: number;
}

export interface EventRecord {
  id: string;
  title: string;
  severity: "minor" | "major";
  action: "weather" | "pirates";
  choice: EventChoice;
  roll: number;
  cargoLost: number;
  creditsLost: number;
  message: string;
}

export interface RunReceipt {
  seed: number;
  contractId: string;
  routeId: string;
  escortUsed: boolean;
  events: EventRecord[];
  startingCredits: number;
  endingCredits: number;
  cargoStart: number;
  cargoEnd: number;
  profit: number;
  reputationDelta: number;
  outcome: "profit" | "loss" | "broken-even";
}

export interface SimulationState {
  seed: number;
  phase: Phase;
  credits: number;
  reputation: number;
  cargo: CargoState;
  contracts: Contract[];
  routes: Route[];
  selectedContractId: string | null;
  selectedRouteId: string | null;
  escort: boolean;
  events: EventRecord[];
  eventIndex: number;
  receipt: RunReceipt | null;
  log: string[];
}

const CONTRACTS: Contract[] = [
  { id: "med-supplies", name: "Med supplies", cargoUnits: 3, buyCost: 180, payout: 420, reputation: 7 },
  { id: "reactor-parts", name: "Reactor parts", cargoUnits: 5, buyCost: 310, payout: 720, reputation: 11 },
  { id: "survey-drones", name: "Survey drones", cargoUnits: 2, buyCost: 120, payout: 330, reputation: 5 },
];

const ROUTES: Route[] = [
  { id: "lantern", name: "Lantern Corridor", risk: 0.18, fuelCost: 45, multiplier: 1.0 },
  { id: "blackwater", name: "Blackwater Cut", risk: 0.42, fuelCost: 25, multiplier: 1.35 },
  { id: "long-haul", name: "Long Haul Arc", risk: 0.28, fuelCost: 70, multiplier: 1.18 },
];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function createRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function createInitialState(seed: number): SimulationState {
  return {
    seed,
    phase: "contract",
    credits: 1000,
    reputation: 50,
    cargo: { id: "hold-a", units: 0, maxUnits: 8 },
    contracts: CONTRACTS.map((contract) => ({ ...contract })),
    routes: ROUTES.map((route) => ({ ...route })),
    selectedContractId: null,
    selectedRouteId: null,
    escort: false,
    events: [],
    eventIndex: 0,
    receipt: null,
    log: ["Select a contract to open the route board."],
  };
}

export function selectContract(state: SimulationState, contractId: string): SimulationState {
  if (state.phase !== "contract") return state;
  const contract = state.contracts.find((entry) => entry.id === contractId);
  if (!contract || contract.buyCost > state.credits || contract.cargoUnits > state.cargo.maxUnits) return state;
  return {
    ...state,
    phase: "route",
    selectedContractId: contract.id,
    cargo: { ...state.cargo, units: contract.cargoUnits },
    credits: state.credits - contract.buyCost,
    log: [`Contract secured: ${contract.name}. Choose a route.`],
  };
}

export function selectRoute(state: SimulationState, routeId: string): SimulationState {
  if (state.phase !== "route" || !state.selectedContractId) return state;
  const route = state.routes.find((entry) => entry.id === routeId);
  if (!route || route.fuelCost > state.credits) return state;
  return {
    ...state,
    phase: "event",
    selectedRouteId: route.id,
    credits: state.credits - route.fuelCost,
    eventIndex: 0,
    log: [`Route locked: ${route.name}. Resolve the travel events.`],
  };
}

export function toggleEscort(state: SimulationState): SimulationState {
  if (state.phase !== "route") return state;
  return { ...state, escort: !state.escort };
}

export function resolveEvent(state: SimulationState, choice: EventChoice = "hold"): SimulationState {
  if (state.phase !== "event" || !state.selectedRouteId || !state.selectedContractId) return state;
  const route = state.routes.find((entry) => entry.id === state.selectedRouteId);
  const contract = state.contracts.find((entry) => entry.id === state.selectedContractId);
  if (!route || !contract) return state;
  const rng = createRng(state.seed + state.eventIndex * 7919 + route.id.length);
  const roll = rng();
  const escortReduction = state.escort ? 0.15 : 0;
  const evadeReduction = choice === "evade" ? 0.1 : 0;
  const hostile = roll < Math.max(0.03, route.risk - escortReduction - evadeReduction);
  const cargoLost = hostile ? Math.max(1, Math.ceil(contract.cargoUnits * (state.escort ? 0.12 : choice === "evade" ? 0.18 : 0.28))) : 0;
  const baseCreditsLost = hostile ? (state.escort ? 20 : choice === "evade" ? 35 : 55) : 0;
  const decisionCost = choice === "evade" ? 12 : 0;
  const creditsLost = baseCreditsLost + decisionCost;
  const event: EventRecord = {
    id: `${route.id}-${state.eventIndex}`,
    title: hostile ? "Contact on the route" : "Clean passage",
    severity: hostile ? (state.escort ? "minor" : "major") : "minor",
    action: hostile ? "pirates" : "weather",
    choice,
    roll: Number(roll.toFixed(4)),
    cargoLost,
    creditsLost,
    message: hostile
      ? `${choice === "evade" ? "Evasive maneuver" : "Holding course"} cost ${cargoLost} cargo and ${creditsLost} credits.`
      : `${choice === "evade" ? "Evasive maneuver" : "Holding course"} succeeded. No cargo lost.`,
  };
  const nextEvents = [...state.events, event];
  const nextCargo = clamp(state.cargo.units - cargoLost, 0, state.cargo.maxUnits);
  const nextCredits = clamp(state.credits - creditsLost, 0, Number.MAX_SAFE_INTEGER);
  const finalEvent = nextEvents.length >= 2;
  return {
    ...state,
    phase: finalEvent ? "settlement" : "event",
    cargo: { ...state.cargo, units: nextCargo },
    credits: nextCredits,
    eventIndex: state.eventIndex + 1,
    events: nextEvents,
    log: [...state.log, event.message],
  };
}

export function settleRun(state: SimulationState): SimulationState {
  if (state.phase !== "settlement" || !state.selectedContractId || !state.selectedRouteId || state.receipt) return state;
  const contract = state.contracts.find((entry) => entry.id === state.selectedContractId);
  const route = state.routes.find((entry) => entry.id === state.selectedRouteId);
  if (!contract || !route) return state;
  const startingCredits = 1000;
  const escortCost = state.escort ? 70 : 0;
  const payout = Math.round(contract.payout * route.multiplier * (state.cargo.units / contract.cargoUnits));
  const endingCredits = clamp(state.credits + payout - escortCost, 0, Number.MAX_SAFE_INTEGER);
  const profit = endingCredits - startingCredits;
  const reputationDelta = state.cargo.units > 0 ? contract.reputation : -Math.ceil(contract.reputation / 2);
  const outcome = profit > 0 ? "profit" : profit < 0 ? "loss" : "broken-even";
  const receipt: RunReceipt = {
    seed: state.seed,
    contractId: contract.id,
    routeId: route.id,
    escortUsed: state.escort,
    events: state.events.map((event) => ({ ...event })),
    startingCredits,
    endingCredits,
    cargoStart: contract.cargoUnits,
    cargoEnd: state.cargo.units,
    profit,
    reputationDelta,
    outcome,
  };
  return {
    ...state,
    phase: "settlement",
    credits: endingCredits,
    reputation: clamp(state.reputation + reputationDelta, 0, 100),
    receipt,
    log: [...state.log, `Run settled: ${outcome}. Profit ${profit} credits.`],
  };
}

export function restartRun(seed: number): SimulationState {
  return createInitialState(seed);
}

export function buildReceipt(state: SimulationState): RunReceipt | null {
  return state.receipt ? { ...state.receipt, events: state.receipt.events.map((event) => ({ ...event })) } : null;
}
