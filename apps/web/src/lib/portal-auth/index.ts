/**
 * Portal Auth barrel export — FE-003
 */

export { PortalAuthProvider, usePortalAuth } from "./context";
export {
  mockPortalForgotPassword,
  mockPortalGetMe,
  mockPortalLogin,
  mockPortalResetPassword,
} from "./mock";
export {
  clearPortalSession,
  hasPortalSession,
  loadPortalSession,
  savePortalSession,
} from "./storage";
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
  PortalResetPasswordRequest,
  PortalResetResult,
} from "./types";
