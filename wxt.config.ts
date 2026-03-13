import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-solid"],
  manifestVersion: 3,
  manifest: {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:",
    },
    permissions: [
      "identity",
      "identity.email",
      "storage",
      "contextMenus",
      "tabs",
      "activeTab",
      "notifications",
    ],
    host_permissions: ["https://www.googleapis.com/*"],
    action: {
      default_title: "Drive GO",
    },
    oauth2: {
      client_id:
        "531460003531-oh7s45m6jl7sql4qj11l3nanoejrg5pl.apps.googleusercontent.com",
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.activity.readonly",
      ],
    },
  },
});
