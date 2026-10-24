/**
 * Types of the engine contract (docs/ENGINE-API.md), re-exported from `@epjn/engine` so the UI never
 * drifts from it. Import from here (or from `@/lib/engine`), not from the package directly.
 */
import type { CurvePoint, Household, PerAdultResult, hourOfWork } from '@epjn/engine';

export type {
  Activity,
  Adult,
  CasType,
  Child,
  Comparison,
  Component,
  ComponentGroup,
  ComponentId,
  Disability,
  Household,
  HousingStatus,
  HourSplit,
  Hypotheses,
  Period,
  SalaryStatus,
  ScenarioResult,
  SimulateOptions as EngineOptions,
  SourceRef,
  Tier,
  UnquantifiedItem,
  WaterfallStep,
} from '@epjn/engine';

export type PerAdult = PerAdultResult;
export type EarningsPoint = CurvePoint;
export type HourOfWork = ReturnType<typeof hourOfWork>;
export type Childcare = NonNullable<NonNullable<Household['extras']>['childcare']>;
