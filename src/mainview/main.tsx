import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "./index.css";
import App from "./App";
import { AppStateProvider } from "./state/appState";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Theme appearance="dark" accentColor="indigo" grayColor="slate">
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </Theme>
  </StrictMode>,
);
