#!/usr/bin/env deno run --allow-read --allow-write --allow-env --allow-net
import { Command } from "commander";
import { join } from "@std/path";
import { ensureDir, exists } from "@std/fs";
import dedent from "dedent";
import { HooksConfig, type HookResponse } from "./lib/schemas/index.ts";

const program = new Command();

program
  .name("claude-hooks")
  .description("CLI for managing Claude hooks")
  .version("1.0.0");

// Init hooks command
program
  .command("init")
  .description("Initialize hooks setup")
  .option(
    "-s, --scope <scope>",
    "Settings scope: user, project, or local",
    "project",
  )
  .action(async (options: { scope?: string }) => {
    try {
      await initHooks(options);
    } catch (error) {
      console.error(
        "Error initializing hooks:",
        error instanceof Error ? error.message : String(error),
      );
      Deno.exit(1);
    }
  });

// Run hooks command
program
  .command("run <file> <event>")
  .description("Run hooks file for a specific event")
  .option("-p, --payload <payload>", "JSON payload to pass to hooks")
  .action(
    async (file: string, event: string, options: { payload?: string }) => {
      try {
        await runHooksFile(file, event, options.payload);
      } catch (error) {
        console.error(
          "Error running hooks:",
          error instanceof Error ? error.message : String(error),
        );
        Deno.exit(1);
      }
    },
  );

// Smart merge function that preserves existing hooks unless they use claude-hooks
function smartMergeSettings(existing: any, newSettings: HooksConfig): any {
  const result = { ...existing };

  // If no existing hooks, just use new settings
  if (!existing.hooks) {
    return newSettings;
  }

  // For each hook type in the new settings
  for (const [hookType, newHooks] of Object.entries(newSettings.hooks)) {
    const existingHooks = existing.hooks[hookType] || [];

    // Filter out existing hooks that use claude-hooks commands
    const preservedHooks = existingHooks.filter((hook: any) => {
      if (hook.type === "command" && 
          (hook.command?.startsWith("claude-hooks") || 
           hook.command?.includes("/claude-hooks"))) {
        return false;
      }
      if (hook.hooks) {
        // For nested hooks structure (like PreToolUse/PostToolUse)
        return !hook.hooks.some((nestedHook: any) =>
          nestedHook.type === "command" &&
          (nestedHook.command?.startsWith("claude-hooks") || 
           nestedHook.command?.includes("/claude-hooks"))
        );
      }
      return true;
    });

    // Combine preserved hooks with new claude-hooks
    result.hooks = result.hooks || {};
    result.hooks[hookType] = [...preservedHooks, ...newHooks];
  }

  return result;
}

// Helper function to get the absolute path to the claude-hooks binary
function getClaudeHooksPath(): string {
  // When running from compiled binary, use the binary path itself
  if (Deno.execPath().includes('claude-hooks')) {
    return Deno.execPath();
  }
  
  // When running from source, construct the path
  const currentScript = new URL(import.meta.url).pathname;
  const currentDir = currentScript.replace('/cli.ts', '');
  return join(currentDir, 'bin', 'claude-hooks');
}

// Implementation functions
async function initHooks(options: { scope?: string }) {
  const scope = options.scope || "project";
  let claudeDir: string;
  let settingsFile: string;
  let hooksFile: string;
  let location: string;
  let description: string;

  // Determine which settings location to use
  switch (scope.toLowerCase()) {
    case "user": {
      const homeDir = Deno.env.get("HOME");
      if (!homeDir) {
        throw new Error("HOME environment variable not found");
      }
      claudeDir = join(homeDir, ".claude");
      settingsFile = "settings.json";
      hooksFile = "hooks.ts";
      location = "user";
      description = "User settings (~/.claude/settings.json)";
      break;
    }

    case "project": {
      claudeDir = join(Deno.cwd(), ".claude");
      settingsFile = "settings.json";
      hooksFile = "hooks.ts";
      location = "project";
      description = "Project settings (./.claude/settings.json)";
      break;
    }

    case "local": {
      claudeDir = join(Deno.cwd(), ".claude");
      settingsFile = "settings.local.json";
      hooksFile = "hooks.local.ts";
      location = "local project";
      description = "Local project settings (./.claude/settings.local.json)";
      break;
    }

    default: {
      throw new Error(
        `Invalid scope: ${scope}. Must be 'user', 'project', or 'local'.`,
      );
    }
  }

  await ensureDir(claudeDir);

  // Create hooks file
  const hooksPath = join(claudeDir, hooksFile);
  const hooksExists = await exists(hooksPath);

  if (!hooksExists) {
    const hooksTemplate = getHooksTemplate();
    await Deno.writeTextFile(hooksPath, hooksTemplate);
    console.log(`Created ${hooksFile} at: ${hooksPath}`);
  } else {
    console.log(`${hooksFile} already exists at: ${hooksPath}`);
  }

  // Create or update settings file
  const settingsPath = join(claudeDir, settingsFile);
  let existingSettings = {};

  // Read existing settings if they exist
  if (await exists(settingsPath)) {
    try {
      const existingContent = await Deno.readTextFile(settingsPath);
      existingSettings = JSON.parse(existingContent);
      console.log(`Found existing settings at: ${settingsPath}`);
    } catch (error) {
      console.warn(
        `Warning: Could not parse existing settings: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // Generate hooks configuration
  try {
    // Verify the hooks file can be imported and has proper structure
    const hooksModule = await import(`file://${hooksPath}`);
    const hooksPlugin = hooksModule.default;

    if (!hooksPlugin || typeof hooksPlugin !== "object") {
      throw new Error(
        "Hooks file must export a default hooks configuration object",
      );
    }

    // Get the absolute path to the claude-hooks binary
    const claudeHooksPath = getClaudeHooksPath();

    // Create complete Claude Code settings configuration
    const completeSettings: HooksConfig = {
      // Hooks configuration
      hooks: {
        // Tool-based hooks use ToolMatcher format with matcher and hooks array
        PreToolUse: [
          {
            matcher: ".*", // Match all tools
            hooks: [
              {
                type: "command",
                command: `${claudeHooksPath} run .claude/${hooksFile} PreToolUse`,
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: ".*", // Match all tools
            hooks: [
              {
                type: "command",
                command: `${claudeHooksPath} run .claude/${hooksFile} PostToolUse`,
              },
            ],
          },
        ],
        // Event-based hooks also use wrapper with hooks array (no matcher though)
        Notification: [
          {
            hooks: [
              {
                type: "command",
                command: `${claudeHooksPath} run .claude/${hooksFile} Notification`,
              },
            ],
          },
        ],
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command: `${claudeHooksPath} run .claude/${hooksFile} UserPromptSubmit`,
              },
            ],
          },
        ],
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: `${claudeHooksPath} run .claude/${hooksFile} Stop`,
              },
            ],
          },
        ],
        SubagentStop: [
          {
            hooks: [
              {
                type: "command",
                command: `${claudeHooksPath} run .claude/${hooksFile} SubagentStop`,
              },
            ],
          },
        ],
        PreCompact: [
          {
            hooks: [
              {
                type: "command",
                command: `${claudeHooksPath} run .claude/${hooksFile} PreCompact`,
              },
            ],
          },
        ],
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: `${claudeHooksPath} run .claude/${hooksFile} SessionStart`,
              },
            ],
          },
        ],
      },
    };

    // Smart merge with existing settings
    const updatedSettings = smartMergeSettings(
      existingSettings,
      completeSettings,
    );

    await Deno.writeTextFile(
      settingsPath,
      JSON.stringify(updatedSettings, null, 2),
    );
    console.log(`Updated hooks configuration in: ${settingsPath}`);
  } catch (error) {
    console.warn(
      `Warning: Could not generate hooks configuration: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    console.log(
      `You can run the ${hooksFile} file manually to generate the configuration.`,
    );
  }

  console.log(`\n✅ Hooks initialized in ${location} settings!`);
  console.log(`📍 Location: ${description}`);
  console.log(`\nTo test your hooks:`);
  console.log(`  ${getClaudeHooksPath()} run ${hooksPath} SessionStart`);
}

async function runHooksFile(file: string, event: string, payload?: string) {
  try {
    // Import the hooks file as a module
    const hooksModule = await import(`file://${Deno.cwd()}/${file}`);
    const hooksPlugin = hooksModule.default;

    if (!hooksPlugin || typeof hooksPlugin !== "object") {
      throw new Error(
        "Hooks file must export a default hooks configuration object",
      );
    }

    // Parse payload from argument
    let parsedPayload = {};
    if (payload) {
      try {
        parsedPayload = JSON.parse(payload);
      } catch (error) {
        console.warn("Failed to parse payload argument as JSON:", error instanceof Error ? error.message : String(error));
      }
    }

    // Execute the appropriate hook handler directly
    let result: HookResponse = { action: "continue" };
    const hookHandler = hooksPlugin["on" + event];

    if (typeof hookHandler === 'function') {
      try {
        result = await hookHandler(parsedPayload) || { action: "continue" };
      } catch (error) {
        result = {
          action: "continue",
          message: `Hook execution error: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    } else {
      result = {
        action: "continue",
        message: `No handler found for event type: ${event}`
      };
    }

    // Output the result
    console.log(JSON.stringify(result));
  } catch (error) {
    throw new Error(
      `Failed to run hooks file: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function getHooksTemplate(): string {
  return dedent`
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
        console.log(\`📝 About to use tool: \${payload.tool_name}\`);
        return { action: "continue" };
      },

      onSessionStart(payload) {
        console.log(\`🚀 Session started in: \${payload?.context?.working_directory || 'unknown'}\`);
        return { action: "continue" };
      }
    };
`;
}

if (import.meta.main) {
  program.parse();
}
