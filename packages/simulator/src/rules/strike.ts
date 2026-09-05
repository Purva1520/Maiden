/** Strike-rotation rules (§30). */

/** Odd runs swap the strike; even runs keep it. */
export function shouldRotateOnRuns(runs: number): boolean {
  return runs % 2 === 1;
}
