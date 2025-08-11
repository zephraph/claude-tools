#!/usr/bin/env deno run --allow-read --allow-write --allow-net --allow-env
import {
  createHooksPlugin,
  type HookResponse,
  HooksManager,
  type NotificationPayload,
  type PostToolUsePayload,
  type PreToolUsePayload,
} from "../lib/plugin-api.ts";

// Example: Local plugin for file validation
const fileValidationPlugin = createHooksPlugin({
  name: "file-validator",
  version: "1.0.0",
  description: "Validates file operations before execution",

  permissions: {
    allow: {
      read: ["."],
      write: ["."],
      env: ["PWD", "HOME"],
    },
    deny: {
      write: ["/etc", "/usr", "/System"],
    },
  },

  async onPreToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
    if (payload.tool_name === "Write" || payload.tool_name === "Edit") {
      const filePath = payload.tool_input.file_path as string;

      // Block writes to system directories
      if (filePath?.startsWith("/etc") || filePath?.startsWith("/usr")) {
        return {
          action: "block",
          message: `Blocked write to system directory: ${filePath}`,
        };
      }

      // Log file operations
      console.log(
        `✓ File operation validated: ${payload.tool_name} on ${filePath}`,
      );
    }

    return { action: "continue" };
  },

  async onPostToolUse(payload: PostToolUsePayload): Promise<HookResponse> {
    if (payload.tool_name === "Write" || payload.tool_name === "Edit") {
      const filePath = payload.tool_input.file_path as string;
      console.log(
        `✓ File operation completed: ${payload.tool_name} on ${filePath}`,
      );
    }

    return { action: "continue" };
  },
});

// Example: Notification plugin
const notificationPlugin = createHooksPlugin({
  name: "desktop-notifications",
  version: "1.0.0",
  description: "Shows desktop notifications for important events",

  permissions: {
    allow: {
      run: ["osascript", "notify-send", "powershell.exe"],
    },
  },

  async onNotification(payload: NotificationPayload): Promise<HookResponse> {
    if (payload.type === "permission_request") {
      // Show OS notification
      try {
        await new Deno.Command("osascript", {
          args: [
            "-e",
            `display notification "${payload.message}" with title "Claude Code"`,
          ],
        }).output();
      } catch {
        // Fallback for non-macOS
        console.log(`🔔 ${payload.message}`);
      }
    }

    return { action: "continue" };
  },
});

// Example: Custom logging plugin
const loggingPlugin = createHooksPlugin({
  name: "session-logger",
  version: "1.0.0",
  description: "Logs session activity to file",

  permissions: {
    allow: {
      write: ["./logs"],
      read: ["./logs"],
    },
  },

  async onSessionStart(payload: SessionStartPayload): Promise<HookResponse> {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - Session started\n`;

    try {
      await Deno.mkdir("./logs", { recursive: true });
      await Deno.writeTextFile("./logs/claude-activity.log", logEntry, {
        append: true,
      });
    } catch (error) {
      console.warn("Failed to write to log:", error.message);
    }

    return { action: "continue" };
  },
});

// Create plugin manager and register plugins
const manager = new HooksManager({
  allow: {
    read: ["."],
    write: ["."],
    net: false,
    env: ["PWD", "HOME", "USER"],
  },
});

// Register plugins
manager
  .use(fileValidationPlugin)
  .use(notificationPlugin)
  .use(loggingPlugin);

// Main execution function
async function main() {
  const eventType = Deno.args[0];

  if (!eventType) {
    console.error("Usage: hooks.ts <EventType>");
    Deno.exit(1);
  }

  // Read payload from stdin
  let payload: unknown = {};
  try {
    const stdinText = await new Response(Deno.stdin.readable).text();
    if (stdinText.trim()) {
      payload = JSON.parse(stdinText);
    }
  } catch (error) {
    console.warn("Failed to parse stdin as JSON:", error.message);
  }

  // Execute hooks
  const results = await manager.executeHooks(eventType, payload);

  // Return the first blocking result or the last result
  const blockingResult = results.find((r) => r.action === "block");
  const finalResult = blockingResult || results[results.length - 1] ||
    { action: "continue" };

  console.log(JSON.stringify(finalResult));
}

// Export for Claude Code hooks configuration
export function makeHooks() {
  return manager.generateHooksConfig();
}

// Export the manager for testing
export { manager };

// Run if called directly
if (import.meta.main) {
  await main();
}
