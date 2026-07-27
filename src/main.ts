import Phaser from "phaser";
import "./styles.css";

import { createInitialState } from "./simulation";
import { createHud } from "./hud";
import { CargoScene } from "./game";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("app root missing");

const shell = document.createElement("div");
shell.className = "game-shell";
const canvasRoot = document.createElement("div");
canvasRoot.className = "game-canvas";
canvasRoot.setAttribute("aria-label", "Cargo route playfield");
const hudRoot = document.createElement("aside");
hudRoot.className = "hud";
hudRoot.setAttribute("aria-label", "Cargo mission controls");
shell.append(canvasRoot, hudRoot);
app.replaceChildren(shell);

const state = createInitialState(42);

const scene = new CargoScene(state);
new Phaser.Game({
  type: Phaser.AUTO,
  parent: canvasRoot,
  backgroundColor: "#081116",
  width: 1280,
  height: 760,
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene,
});

createHud(hudRoot, state, scene);
