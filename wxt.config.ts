import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-solid"],
  manifestVersion: 3,
  manifest: {
    permissions: ["identity", "storage"],
    host_permissions: ["https://www.googleapis.com/*"],
    action: {
      default_title: "Google Drive Go",
    },
    oauth2: {
      client_id:
        "531460003531-oh7s45m6jl7sql4qj11l3nanoejrg5pl.apps.googleusercontent.com",
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.metadata",
        "https://www.googleapis.com/auth/drive.activity.readonly",
      ],
    },
  },
});
