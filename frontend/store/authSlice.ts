import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Non-secret profile only — JWT lives in an httpOnly cookie. */
export type AuthUser = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
};

type AuthState = {
  user: AuthUser | null;
  /** True after first /api/users/me bootstrap attempt. */
  ready: boolean;
};

const initialState: AuthState = {
  user: null,
  ready: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.ready = true;
    },
    clearUser(state) {
      state.user = null;
      state.ready = true;
    },
    markAuthReady(state) {
      state.ready = true;
    },
  },
});

export const { setUser, clearUser, markAuthReady } = authSlice.actions;
export const authReducer = authSlice.reducer;
