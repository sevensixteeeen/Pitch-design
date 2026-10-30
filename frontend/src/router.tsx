// Every screen in the recon inventory has a route (S01–S24, see replica/recon.md).
import { createBrowserRouter } from "react-router";
import { RequireAuth } from "./auth";
import { AppLayout } from "./layouts/AppLayout";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Projects } from "./pages/Projects";
import { FolderPage } from "./pages/FolderPage";
import { Trash } from "./pages/Trash";
import { Templates } from "./pages/Templates";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/stubs";
import { EditorPage } from "./editor/EditorPage";
import { ResetPassword } from "./pages/ResetPassword";
import { routeResetLink } from "./lib/supabase";

routeResetLink();

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> }, // S01
  { path: "/reset-password", element: <ResetPassword /> }, // S01, opened from the reset email (logs you in)
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> }, // S02, with S03 as its "Create a design" popover
      { path: "templates", element: <Templates /> }, // S04
      { path: "projects", element: <Projects /> }, // S05
      { path: "folders/:folderId", element: <FolderPage /> }, // S06
      { path: "trash", element: <Trash /> }, // S07
      { path: "settings", element: <Settings /> }, // S23 (change password)
    ],
  },
  {
    // S08 editor (S09–S22 are its panels and dialogs): full screen, no sidebar
    path: "/design/:designId/edit",
    element: (
      <RequireAuth>
        <EditorPage />
      </RequireAuth>
    ),
  },
  { path: "*", element: <NotFound /> }, // S24
]);
