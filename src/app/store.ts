import { Action, AnyAction, ThunkAction, configureStore } from '@reduxjs/toolkit';
import reducer, { rootEpic } from '../reducers';

import { createEpicMiddleware } from 'redux-observable';

type R = typeof reducer
export type RootState = { [K in keyof R]: ReturnType<R[K]> }

const epicMiddleware = createEpicMiddleware<AnyAction, AnyAction, RootState>()
export const store = configureStore({
  reducer: reducer,
  middleware: (getDefaultMiddleware => [...getDefaultMiddleware(), epicMiddleware])
})
epicMiddleware.run(rootEpic)

export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;