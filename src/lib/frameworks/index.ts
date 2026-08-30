/**
 * GAMBIT YourMove — framework fleet public surface.
 *
 * The fleet reads one message through several theoretical lenses and seals a
 * verdict deterministically, before any model is called. See fleet.ts for the
 * architecture and the three guarantees it enforces.
 */

export {
  runFleet,
  verifyFleetSeal,
  levelFor,
  CORROBORATION_THRESHOLD,
  FLEET_SCHEMA_VERSION,
  FLEET_SEAL_VERSION,
  type FleetVerdict,
  type FleetLevel,
  type FleetConfidence,
  type SealedSignal,
} from './fleet';
export { FRAMEWORK_NAMES, type FrameworkName, type FrameworkSignal } from './types';
export { assessScope, type Coverage, type ScopeAssessment } from './scope';
export {
  severityFromGrid,
  semanticVote,
  unavailableSemantic,
  SEMANTIC_GRID,
  SEMANTIC_WEIGHT,
  type SemanticSignal,
} from './semantic';
export {
  composeVerdict,
  verifyCompositeSeal,
  COMPOSITE_SCHEMA_VERSION,
  COMPOSITE_SEAL_VERSION,
  type CompositeVerdict,
  type DeterminismLevel,
  type Divergence,
} from './composite';
