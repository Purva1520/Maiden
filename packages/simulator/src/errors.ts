/** Domain errors for the Maiden simulation engine (§116). */

export class SimulationError extends Error {}

export class InvalidFormatError extends SimulationError {}
export class InvalidTeamError extends SimulationError {}
export class InvalidRatingError extends SimulationError {}
export class NoEligibleBowlerError extends SimulationError {}
export class SimulationInvariantError extends SimulationError {}
