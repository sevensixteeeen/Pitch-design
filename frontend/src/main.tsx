import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { Tooltip } from "radix-ui";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk"; // headings and the wordmark (also one of the editor's fonts)
import "@fontsource-variable/playfair-display"; // page titles (also one of the editor's fonts)
import "@fontsource-variable/playfair-display/wght-italic.css"; // the italic word in page titles
import "./styles/index.css";
import { AuthProvider } from "./auth";
import { Toaster } from "./components/ui/feedback";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      {/* every IconButton's tooltip needs this provider once, at the top */}
      <Tooltip.Provider delayDuration={400}>
        <RouterProvider router={router} />
        <Toaster />
      </Tooltip.Provider>
    </AuthProvider>
  </StrictMode>,
);
