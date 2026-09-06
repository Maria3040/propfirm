import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type UiState = {
  basketOpen: boolean;
};

const initialState: UiState = {
  basketOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setBasketOpen(state, action: PayloadAction<boolean>) {
      state.basketOpen = action.payload;
    },
  },
});

export const { setBasketOpen } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
