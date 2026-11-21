/**
 * Auth barrel — FE-002, FE-004
 */
export {
  backendGetMe,
  backendLogin,
  backendLogout,
  clientGetMe,
  clientLogin,
  clientLogout,
  getBackendApiUrl,
} from "./api";
export { AuthProvider, useAuth } from "./context";
export { clearSession, hasSession, loadSession, saveSession } from "./storage";
export type {
  ApiErrorPayload,
  ApiErrorResponse,
  AuthAgency,
  AuthSession,
  AuthUser,
  LoginError,
  LoginRequest,
  LoginResponse,
  LoginResult,
  MeResponse,
} from "./types";
export { TOKEN_STORAGE_KEY } from "./types";
