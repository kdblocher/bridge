import './index.css';

import * as serviceWorker from './serviceWorker';

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { store } from './app/store';
import App from './components';
import Design from './components/Design';
import Analyze from './components/Analyze';
import { FluentProvider, teamsLightTheme, } from '@fluentui/react-components';

const router = createBrowserRouter([
  {
    path: "/", element: <App />, children: [
      { path: "/design", element: <Design /> },
      { path: "/analyze", element: <Analyze /> },
    ]
  },
], {
  basename: "/bridge"
})

ReactDOM.render(
  <React.StrictMode>
    <FluentProvider theme={teamsLightTheme}>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </FluentProvider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
