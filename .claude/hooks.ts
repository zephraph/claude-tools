import { hooks } from "../main.ts";

export default hooks({
  // Deno permissions that are allowed
  permissions: {
    allow: {
      read: ["."],
      write: ["."],
      env: ["PWD", "HOME", "USER"],
    },
  },

  // Example hook implementations
  onPreToolUse(payload) {
    console.log(`📝 About to use tool: ${payload.tool_name}`);
    return { action: "block" };
  },

  onNotification(payload) {
    console.log(`🔔 Notification received: ${payload.message}`);
    return { action: "continue" };
  },
});
