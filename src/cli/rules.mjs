/**
 * CLI-facing re-export of the decision box.
 *
 * The walls themselves live in src/core/walls.mjs because the website runs the
 * same file in the browser. Keeping one implementation is the point: a verdict
 * shown on the site is the verdict the terminal would print.
 */
export { WALL_ORDER, dormancyDays, evaluate, ruleSheet } from '../core/walls.mjs';
