/**
 * Auth barrel — FE-002, FE-004
 */
export {
  backendGetMe,
  backendGetMemberships,
  backendLogin,
  backendLogout,
  backendSelectAgency,
  backendSwitchAgency,
  clientGetMe,
  clientGetMemberships,
  clientLogin,
  clientLogout,
  clientSelectAgency,
  clientSwitchAgency,
  getBackendApiUrl,
} from "./api";
export { AuthProvider, useAuth } from "./context";
export {
  clearCachedSession,
  clearSelection,
  clearSession,
  hasSession,
  loadSelection,
  loadSession,
  saveSelection,
  saveSession,
} from "./storage";
export type {
  AgencyMembership,
  AgencySelection,
  ApiErrorPayload,
  ApiErrorResponse,
  AuthAgency,
  AuthSession,
  AuthUser,
  BackendSession,
  LoginError,
  LoginRequest,
  LoginResponse,
  LoginResult,
  MeResponse,
  MembershipsResponse,
  SessionResponse,
  SessionResult,
} from "./types";
export { SELECTION_STORAGE_KEY, TOKEN_STORAGE_KEY } from "./types";
