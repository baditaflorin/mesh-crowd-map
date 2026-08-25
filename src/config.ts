import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-crowd-map",
  displayName: "Crowd Map",
  visualProfile: "field",
  shellLayout: "inset",
  description: "A privacy-safe shared board for coarse, short-lived observations.",
  accentHex: "#f59e0b",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
