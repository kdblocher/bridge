import { createEpicMiddleware } from 'redux-observable';

import { Action, AnyAction, configureStore, ThunkAction } from '@reduxjs/toolkit';

import reducer, { rootEpic } from '../reducers';

type R = typeof reducer
export type RootState = { [K in keyof R]: ReturnType<R[K]> }

const epicMiddleware = createEpicMiddleware<AnyAction, AnyAction, RootState>()
export const store = configureStore({
  reducer: reducer,
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(epicMiddleware)
})
epicMiddleware.run(rootEpic)

export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;