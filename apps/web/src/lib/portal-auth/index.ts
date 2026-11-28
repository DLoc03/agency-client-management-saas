/**
 * Portal Auth barrel export — FE-003, real-API wiring FE-013
 */

export { PortalAuthProvider, usePortalAuth } from "./context";
export { updateProfileLocale } from "./profile";
export { PORTAL_TOKEN_STORAGE_KEY } from "./types";
export type {
  PortalAgency,
  PortalAuthSession,
  PortalClient,
  PortalForgotPasswordRequest,
  PortalLoginRequest,
  PortalLoginResponse,
  PortalLoginResult,
  PortalMeResponse,
  PortalProject,
  PortalResetPasswordRequest,
  PortalResetResult,
} from "./types";
