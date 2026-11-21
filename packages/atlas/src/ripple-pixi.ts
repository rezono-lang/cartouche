/**
 * Sheet 04: PixiJS v8 (MIT) Renderer for the Causal Ripple Graph.
 * Pure renderer only — consumes the headless CausalRippleModel without any client compute.
 * Headless tests can verify buildPixiDrawPlan(model) without WebGL.
 */

import { Application, Graphics } from 'pixi.js';
import { PALETTES } from '../../reader-core/src/index.ts';
import type { PaletteTokens } from '../../reader-core/src/index.ts';
import type { CausalRippleModel, RippleNodeState } from './ripple-layout.ts';

export interface PixiRectCommand {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly radius: number;
  readonly fill: string | null;
  readonly stroke: string;
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
  readonly stroke: string;
  readonly strokeWidth: number;
}

export type PixiDrawCommand = PixiRectCommand | PixiCurveCommand;

export interface PixiDrawPlan {
  readonly width: number;
  readonly height: number;
  readonly background: string;
  readonly commands: readonly PixiDrawCommand[];
}

function colorForState(state: RippleNodeState, palette: PaletteTokens): string {
  if (state === 'violated' || state === 'invalid') return palette.violated;
  if (state === 'changed') return palette.caution;
  if (state === 'valid' || state === 'known') return palette.valid;
  if (state === 'unknown') return palette.hatchStroke;
  return palette.inkSoft;
}

/**
 * Produces a deterministic, WebGL-free PixiJS v8 draw plan from the headless CausalRippleModel,
 * deriving every color strictly from canonical std-view PALETTES (single source of truth).
 */
export function buildPixiDrawPlan(model: CausalRippleModel): PixiDrawPlan {
  const colors = PALETTES[model.theme];
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
      stroke: colorForState(n.state, colors),
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
