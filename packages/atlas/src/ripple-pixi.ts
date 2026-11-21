/**
 * Sheet 04: PixiJS v8 (MIT) Renderer for the Causal Ripple Graph.
 * Pure renderer only — consumes the headless CausalRippleModel without any client compute.
 * Headless tests can verify buildPixiDrawPlan(model) without WebGL.
 */

import { Application, Graphics } from 'pixi.js';
import type { PaletteName } from '../../reader-core/src/index.ts';
import type { CausalRippleModel, RippleNodeState } from './ripple-layout.ts';

export interface PixiRectCommand {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly radius: number;
  readonly fill: number | null;
  readonly stroke: number;
  readonly strokeWidth: number;
}

export interface PixiCurveCommand {
  readonly kind: 'curve';
  readonly x1: number;
  readonly y1: number;
  readonly cx1: number;
  readonly cy1: number;
  readonly cx2: number;
  readonly cy2: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: number;
  readonly strokeWidth: number;
}

export type PixiDrawCommand = PixiRectCommand | PixiCurveCommand;

export interface PixiDrawPlan {
  readonly width: number;
  readonly height: number;
  readonly background: number;
  readonly commands: readonly PixiDrawCommand[];
}

interface PixiThemeHex {
  readonly paper: number;
  readonly paperElev: number;
  readonly rule: number;
  readonly ruleStrong: number;
  readonly proof: number;
  readonly valid: number;
  readonly caution: number;
  readonly violated: number;
  readonly hatch: number;
  readonly inkSoft: number;
}

const PIXI_THEMES: Readonly<Record<PaletteName, PixiThemeHex>> = Object.freeze({
  swisstopo: Object.freeze({
    paper: 0xf9f8f4,
    paperElev: 0xfefefd,
    rule: 0xcfcac0,
    ruleStrong: 0x33302c,
    proof: 0x2659b8,
    valid: 0x2e6f40,
    caution: 0x996b1f,
    violated: 0xa62b2b,
    hatch: 0x858078,
    inkSoft: 0x5d5953
  }),
  obsidian: Object.freeze({
    paper: 0x151922,
    paperElev: 0x1d2330,
    rule: 0x333c4f,
    ruleStrong: 0xc2c6cf,
    proof: 0x6ea6ff,
    valid: 0x67d484,
    caution: 0xe3b341,
    violated: 0xf26b6b,
    hatch: 0x687287,
    inkSoft: 0x9ea7ba
  }),
  forced: Object.freeze({
    paper: 0x000000,
    paperElev: 0x000000,
    rule: 0xffffff,
    ruleStrong: 0xffffff,
    proof: 0x5ce1ff,
    valid: 0x7dff8a,
    caution: 0xffe047,
    violated: 0xff7a7a,
    hatch: 0xffffff,
    inkSoft: 0xe6e6e6
  })
});

function hexForState(state: RippleNodeState, theme: PixiThemeHex): number {
  if (state === 'violated' || state === 'invalid') return theme.violated;
  if (state === 'changed') return theme.caution;
  if (state === 'valid' || state === 'known') return theme.valid;
  if (state === 'unknown') return theme.hatch;
  return theme.inkSoft;
}

/**
 * Produces a deterministic, WebGL-free PixiJS v8 draw plan from the headless CausalRippleModel.
 */
export function buildPixiDrawPlan(model: CausalRippleModel): PixiDrawPlan {
  const colors = PIXI_THEMES[model.theme];
  const commands: PixiDrawCommand[] = [];

  for (const col of model.columns) {
    commands.push({
      kind: 'rect',
      x: col.x,
      y: col.y,
      w: col.w,
      h: col.h,
      radius: 4,
      fill: colors.paperElev,
      stroke: colors.rule,
      strokeWidth: 1
    });
  }

  for (const e of model.edges) {
    const dx = Math.trunc((e.x2 - e.x1) / 2);
    if (e.kind === 'drift') {
      commands.push({
        kind: 'curve',
        x1: e.x1,
        y1: e.y1 - 4,
        cx1: e.x1 + dx,
        cy1: e.y1 - 4,
        cx2: e.x2 - dx,
        cy2: e.y2 - 4,
        x2: e.x2,
        y2: e.y2 - 4,
        stroke: colors.proof,
        strokeWidth: 2
      });
      commands.push({
        kind: 'curve',
        x1: e.x1,
        y1: e.y1 + 4,
        cx1: e.x1 + dx,
        cy1: e.y1 + 4,
        cx2: e.x2 - dx,
        cy2: e.y2 + 4,
        x2: e.x2,
        y2: e.y2 + 4,
        stroke: colors.violated,
        strokeWidth: 2.5
      });
    } else {
      const stroke = e.cliffPropagation
        ? colors.violated
        : e.absorbedByOrShield
          ? colors.valid
          : colors.ruleStrong;
      commands.push({
        kind: 'curve',
        x1: e.x1,
        y1: e.y1,
        cx1: e.x1 + dx,
        cy1: e.y1,
        cx2: e.x2 - dx,
        cy2: e.y2,
        x2: e.x2,
        y2: e.y2,
        stroke,
        strokeWidth: e.cliffPropagation ? 2.5 : 1.5
      });
    }
  }

  for (const n of model.nodes) {
    if (n.gate === 'OR' && n.loadBearing === false) {
      commands.push({
        kind: 'rect',
        x: n.x - 4,
        y: n.y - 4,
        w: n.w + 8,
        h: n.h + 8,
        radius: 8,
        fill: null,
        stroke: colors.valid,
        strokeWidth: 2
      });
    } else if (n.gate === 'AND' && n.loadBearing === true) {
      commands.push({
        kind: 'rect',
        x: n.x - 4,
        y: n.y - 4,
        w: n.w + 8,
        h: n.h + 8,
        radius: 4,
        fill: null,
        stroke: colors.violated,
        strokeWidth: 2.5
      });
    }

    commands.push({
      kind: 'rect',
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      radius: 4,
      fill: colors.paper,
      stroke: hexForState(n.state, colors),
      strokeWidth: 1.5
    });
  }

  return Object.freeze({
    width: model.width,
    height: model.height,
    background: colors.paper,
    commands: Object.freeze(commands)
  });
}

/**
 * Mounts the PixiJS v8 renderer onto a browser HTMLCanvasElement.
 * Returns a cleanup callback that destroys the PixiJS Application.
 */
export async function mountCausalRipplePixi(
  canvas: HTMLCanvasElement,
  model: CausalRippleModel
): Promise<() => void> {
  const plan = buildPixiDrawPlan(model);
  const app = new Application();
  await app.init({
    canvas,
    width: plan.width,
    height: plan.height,
    background: plan.background,
    antialias: true
  });

  const layer = new Graphics();
  for (const cmd of plan.commands) {
    if (cmd.kind === 'rect') {
      layer.roundRect(cmd.x, cmd.y, cmd.w, cmd.h, cmd.radius);
      if (cmd.fill !== null) {
        layer.fill({ color: cmd.fill });
      }
      layer.stroke({ color: cmd.stroke, width: cmd.strokeWidth });
    } else {
      layer.moveTo(cmd.x1, cmd.y1);
      layer.bezierCurveTo(cmd.cx1, cmd.cy1, cmd.cx2, cmd.cy2, cmd.x2, cmd.y2);
      layer.stroke({ color: cmd.stroke, width: cmd.strokeWidth });
    }
  }
  app.stage.addChild(layer);

  return () => {
    app.destroy(false, { children: true });
  };
}
