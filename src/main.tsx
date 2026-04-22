import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { RaffleProvider } from "./app/RaffleContext";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RaffleProvider>
        <App />
      </RaffleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
