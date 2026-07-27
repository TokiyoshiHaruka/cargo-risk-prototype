import Phaser from "phaser";

import type { SimulationState } from "./simulation";

export class CargoScene extends Phaser.Scene {
  private state: SimulationState;
  private routeLine?: Phaser.GameObjects.Graphics;
  private ship?: Phaser.GameObjects.Triangle;
  private nodes: Phaser.GameObjects.Arc[] = [];
  private cargoCrates: Phaser.GameObjects.Rectangle[] = [];
  private eventPulses: Phaser.GameObjects.Arc[] = [];

  constructor(state: SimulationState) {
    super("cargo-route");
    this.state = state;
  }

  create(): void {
    this.drawScene();
    this.scale.on("resize", () => this.drawScene());
  }

  setState(state: SimulationState): void {
    this.state = state;
    this.drawScene();
  }

  private drawScene(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.routeLine?.destroy();
    this.ship?.destroy();
    this.nodes.forEach((node) => node.destroy());
    this.cargoCrates.forEach((crate) => crate.destroy());
    this.eventPulses.forEach((pulse) => pulse.destroy());
    this.nodes = [];
    this.cargoCrates = [];
    this.eventPulses = [];
    this.routeLine = this.add.graphics();
    const selectedRoute = this.state.routes.find((route) => route.id === this.state.selectedRouteId);
    const routeColor = selectedRoute && selectedRoute.risk >= 0.4 ? 0xef806d : 0x2bc7cc;
    this.routeLine.lineStyle(3, routeColor, 0.75);
    const startX = width * 0.11;
    const endX = width * 0.83;
    const midY = height * 0.52;
    const wobble = Math.min(95, height * 0.13);
    this.routeLine.beginPath();
    this.routeLine.moveTo(startX, midY);
    this.routeLine.lineTo(width * 0.35, midY - wobble);
    this.routeLine.lineTo(width * 0.58, midY + wobble * 0.7);
    this.routeLine.lineTo(endX, midY - wobble * 0.4);
    this.routeLine.strokePath();
    [
      [startX, midY],
      [width * 0.35, midY - wobble],
      [width * 0.58, midY + wobble * 0.7],
      [endX, midY - wobble * 0.4],
    ].forEach(([x, y], index) => {
      const node = this.add.circle(x, y, index === 0 || index === 3 ? 12 : 8, index === 3 ? 0xf2b35c : 0x2bc7cc, 0.95);
      node.setStrokeStyle(2, 0xeaf4f2, 0.55);
      this.nodes.push(node);
    });
    const shipColor = this.state.receipt?.outcome === "profit" ? 0x70d6a4 : this.state.receipt?.outcome === "loss" ? 0xef806d : 0xf2b35c;
    this.ship = this.add.triangle(startX + 30, midY - 18, 0, 26, 50, 13, shipColor, 1);
    this.ship.setStrokeStyle(2, 0xfff0c2, 0.8);

    for (let index = 0; index < this.state.cargo.units; index += 1) {
      const crate = this.add.rectangle(startX - 34 + (index % 4) * 14, midY + 28 + Math.floor(index / 4) * 14, 10, 10, 0xf2b35c, 0.9);
      crate.setStrokeStyle(1, 0xfff0c2, 0.75);
      this.cargoCrates.push(crate);
    }

    const pulseCount = this.state.events.length + (this.state.phase === "event" ? 1 : 0);
    for (let index = 0; index < Math.min(2, pulseCount); index += 1) {
      const pulseX = [width * 0.35, width * 0.58][index];
      const pulseY = [midY - wobble, midY + wobble * 0.7][index];
      const pulse = this.add.circle(pulseX, pulseY, 18 + index * 5, 0xef806d, 0.08);
      pulse.setStrokeStyle(2, 0xef806d, 0.5);
      this.eventPulses.push(pulse);
    }
  }
}
