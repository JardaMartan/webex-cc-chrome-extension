/*
 * widget/store/store.js — single Redux store for the content-script widget.
 */
import { configureStore } from '@reduxjs/toolkit';
import callReducer from './callSlice.js';

export function createStore() {
  return configureStore({
    reducer: { call: callReducer },
  });
}
