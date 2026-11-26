import { RouterProvider } from "@tanstack/react-router";
import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { getRouter } from "./router";

if (window.$_TSR?.router) {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
} else {
  const root = document.getElementById("root");
  if (!root) throw new Error("The offline app shell is missing its root element.");
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={getRouter()} />
    </StrictMode>,
  );
}
