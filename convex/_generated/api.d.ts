/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessibilityPublish from "../accessibilityPublish.js";
import type * as auth from "../auth.js";
import type * as branding from "../branding.js";
import type * as cleanupQa from "../cleanupQa.js";
import type * as graph from "../graph.js";
import type * as lib_a11yPublishChecklist from "../lib/a11yPublishChecklist.js";
import type * as lib_applyA11yPackage from "../lib/applyA11yPackage.js";
import type * as lib_applySpatialPackage from "../lib/applySpatialPackage.js";
import type * as lib_authHelpers from "../lib/authHelpers.js";
import type * as lib_branding from "../lib/branding.js";
import type * as lib_campusSpatialPackage from "../lib/campusSpatialPackage.js";
import type * as lib_hotspotVisual from "../lib/hotspotVisual.js";
import type * as lib_pilotA11yPackage from "../lib/pilotA11yPackage.js";
import type * as lib_tourResolve from "../lib/tourResolve.js";
import type * as media from "../media.js";
import type * as migratePilotMediaUrls from "../migratePilotMediaUrls.js";
import type * as organizations from "../organizations.js";
import type * as seed from "../seed.js";
import type * as seedOrbeSandbox from "../seedOrbeSandbox.js";
import type * as tourAdmin from "../tourAdmin.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessibilityPublish: typeof accessibilityPublish;
  auth: typeof auth;
  branding: typeof branding;
  cleanupQa: typeof cleanupQa;
  graph: typeof graph;
  "lib/a11yPublishChecklist": typeof lib_a11yPublishChecklist;
  "lib/applyA11yPackage": typeof lib_applyA11yPackage;
  "lib/applySpatialPackage": typeof lib_applySpatialPackage;
  "lib/authHelpers": typeof lib_authHelpers;
  "lib/branding": typeof lib_branding;
  "lib/campusSpatialPackage": typeof lib_campusSpatialPackage;
  "lib/hotspotVisual": typeof lib_hotspotVisual;
  "lib/pilotA11yPackage": typeof lib_pilotA11yPackage;
  "lib/tourResolve": typeof lib_tourResolve;
  media: typeof media;
  migratePilotMediaUrls: typeof migratePilotMediaUrls;
  organizations: typeof organizations;
  seed: typeof seed;
  seedOrbeSandbox: typeof seedOrbeSandbox;
  tourAdmin: typeof tourAdmin;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
