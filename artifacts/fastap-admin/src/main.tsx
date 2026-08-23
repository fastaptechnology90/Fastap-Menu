import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  // Whether a service worker was already controlling this page when it loaded. If so, a
  // controllerchange means a NEW version just activated — reload once to run it. On the
  // very first install there's no prior controller, so we skip the reload.
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}


createRoot(document.getElementById("root")!).render(<App />);
