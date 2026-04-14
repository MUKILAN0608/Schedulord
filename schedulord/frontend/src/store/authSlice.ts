import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { getStoredUser, setToken, setStoredUser } from '../api'

interface User {
  id: string
  email: string
  role: 'admin' | 'client' | 'user'
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

const initialState: AuthState = {
  user: getStoredUser(),
  isAuthenticated: !!localStorage.getItem('schedulord_token'),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; token: string }>) {
      const { user, token } = action.payload;
      state.user = user;
      state.isAuthenticated = true;
      setToken(token);
      setStoredUser(user);
    },
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('schedulord_token');
      localStorage.removeItem('schedulord_user');
    },
  },
})

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
