// Simple hooks configuration that doesn't require imports
export default {
  name: "inline-hooks",
  version: "0.0.0",
  
  // Deno permissions that are allowed
  permissions: {
    allow: {
      read: ["."],
      write: ["."],
      env: ["PWD", "HOME", "USER"]
    }
  },

  // Example hook implementations
  onPreToolUse(payload) {
    console.log(`📝 About to use tool: ${payload.tool_name}`);
    return { action: "continue" };
  },

  onSessionStart(payload) {
    console.log(`🚀 Session started in: ${payload?.context?.working_directory || 'unknown'}`);
    return { action: "continue" };
  }
};