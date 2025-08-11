#!/usr/bin/env deno run --allow-read --allow-write --allow-env --allow-net
import { Command } from "commander";
import { join } from "@std/path";
import { ensureDir, exists } from "@std/fs";
import dedent from "dedent";

const program = new Command();

program
  .name("claude-tools")
  .description("CLI for managing Claude tools and hooks")
  .version("1.0.0");

const hooks = program.command("hooks").description("Manage Claude hooks");

// Init hooks command
hooks
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
      console.error("Error initializing hooks:", error instanceof Error ? error.message : String(error));
      Deno.exit(1);
    }
  });

// Run hooks command
hooks
  .command("run <file> <event>")
  .description("Run hooks file for a specific event")
  .option("-p, --payload <payload>", "JSON payload to pass to hooks")
  .action(
    async (file: string, event: string, options: { payload?: string }) => {
      try {
        await runHooksFile(file, event, options.payload);
      } catch (error) {
        console.error("Error running hooks:", error instanceof Error ? error.message : String(error));
        Deno.exit(1);
      }
    },
  );

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
        `Warning: Could not parse existing settings: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Generate hooks configuration
  try {
    const hooksModule = await import(`file://${hooksPath}`);
    const hooksConfig = hooksModule.makeHooks();

    // Merge with existing settings
    const updatedSettings = {
      ...existingSettings,
      ...hooksConfig,
    };

    await Deno.writeTextFile(
      settingsPath,
      JSON.stringify(updatedSettings, null, 2),
    );
    console.log(`Updated hooks configuration in: ${settingsPath}`);
  } catch (error) {
    console.warn(
      `Warning: Could not generate hooks configuration: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.log(
      `You can run the ${hooksFile} file manually to generate the configuration.`,
    );

    // Create empty settings file if it doesn't exist
    if (!await exists(settingsPath)) {
      await Deno.writeTextFile(settingsPath, JSON.stringify({}, null, 2));
      console.log(`Created empty settings file: ${settingsPath}`);
    }
  }

  console.log(`\n✅ Hooks initialized in ${location} settings!`);
  console.log(`📍 Location: ${description}`);
  console.log(`\nTo test your hooks:`);
  console.log(`  claude-tools hooks run ${hooksPath} SessionStart`);
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

    // Extract permissions from the hooks config
    const permissions = hooksPlugin.permissions || {};

    // Build Deno permission flags from the config
    const args = ["run"];

    if (permissions.allow) {
      if (permissions.allow.read) {
        if (Array.isArray(permissions.allow.read)) {
          for (const path of permissions.allow.read) {
            args.push(`--allow-read=${path}`);
          }
        } else if (permissions.allow.read === true) {
          args.push("--allow-read");
        }
      }

      if (permissions.allow.write) {
        if (Array.isArray(permissions.allow.write)) {
          for (const path of permissions.allow.write) {
            args.push(`--allow-write=${path}`);
          }
        } else if (permissions.allow.write === true) {
          args.push("--allow-write");
        }
      }

      if (permissions.allow.net) {
        if (Array.isArray(permissions.allow.net)) {
          for (const host of permissions.allow.net) {
            args.push(`--allow-net=${host}`);
          }
        } else if (permissions.allow.net === true) {
          args.push("--allow-net");
        }
      }

      if (permissions.allow.env) {
        if (Array.isArray(permissions.allow.env)) {
          for (const env of permissions.allow.env) {
            args.push(`--allow-env=${env}`);
          }
        } else if (permissions.allow.env === true) {
          args.push("--allow-env");
        }
      }

      if (permissions.allow.run) {
        if (Array.isArray(permissions.allow.run)) {
          for (const cmd of permissions.allow.run) {
            args.push(`--allow-run=${cmd}`);
          }
        } else if (permissions.allow.run === true) {
          args.push("--allow-run");
        }
      }

      if (permissions.allow.sys) {
        if (Array.isArray(permissions.allow.sys)) {
          for (const sys of permissions.allow.sys) {
            args.push(`--allow-sys=${sys}`);
          }
        } else if (permissions.allow.sys === true) {
          args.push("--allow-sys");
        }
      }
    }

    // Create a temporary script that executes the hook
    const tempScript = `
import { hooks } from "./main.ts";

// Import the hooks configuration
const hooksModule = await import("file://${Deno.cwd()}/${file}");
const hooksPlugin = hooksModule.default;

// Parse payload from stdin or use empty object
let payload = {};
try {
  const stdinText = await new Response(Deno.stdin.readable).text();
  if (stdinText.trim()) {
    payload = JSON.parse(stdinText);
  }
} catch (error) {
  console.warn("Failed to parse stdin as JSON:", error instanceof Error ? error.message : String(error));
}

// Execute the appropriate hook handler
const eventType = "${event}";
let result = { action: "continue" };

if (hooksPlugin["on" + eventType]) {
  try {
    result = await hooksPlugin["on" + eventType](payload) || { action: "continue" };
  } catch (error) {
    result = {
      action: "continue",
      message: \`Hook execution error: \${error instanceof Error ? error.message : String(error)}\`
    };
  }
}

// Output the result
console.log(JSON.stringify(result));
`;

    // Write temporary script
    const tempPath = await Deno.makeTempFile({ suffix: ".ts" });
    await Deno.writeTextFile(tempPath, tempScript);

    try {
      args.push(tempPath);

      const command = new Deno.Command("deno", {
        args,
        stdin: payload ? "piped" : "null",
        stdout: "piped",
        stderr: "piped",
      });

      const process = command.spawn();

      if (payload) {
        const writer = process.stdin.getWriter();
        await writer.write(new TextEncoder().encode(payload));
        await writer.close();
      }

      const { code, stdout, stderr } = await process.output();

      if (code !== 0) {
        const errorText = new TextDecoder().decode(stderr);
        throw new Error(`Hooks execution failed: ${errorText}`);
      }

      const output = new TextDecoder().decode(stdout);
      console.log(output);
    } finally {
      // Clean up temporary file
      try {
        await Deno.remove(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    throw new Error(`Failed to run hooks file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getHooksTemplate(): string {
  return dedent`
    import { hooks } from "claude-tools";

    export default hooks({
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
      }
    });
`;
}

if (import.meta.main) {
  program.parse();
}
