import { defineConfig } from "wxt";

const EXTENSION_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtv6YjV8paaArxaa+NDu9FljUi2J0I6jivgEizbci8Kcp0+ngtTg6otbxz4xzNKOdS48E3RjW1kDTaTb8qk+5eKz8mjs3UCgKxtz4rfzTQUd5B8ZkulqncVoTnZ3ZEE2aPwIpFHs+3VD/STS0tEAOmOU3rkxqEDGL/Hr6sl9zLsrRvhPAEYHWChEfwc5IGUP0lV+RBDkug73l6ZeqhUX6zKoq4avwAgV5hhagT/g87jgd3B5vNiZH90stlEiN3CTW3mF8ObWInzMdQUBarmVh6BfyZWn49fi75SZYDpJI6kRpyYES3q5w0nwwmP3OIVOig46JX4ahOI6JLP9sYdMQlwIDAQAB";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-solid"],
  manifestVersion: 3,
  manifest: {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    key: EXTENSION_PUBLIC_KEY,
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
