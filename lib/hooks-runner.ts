#!/usr/bin/env deno run
// Hooks runner script - executes hooks with proper isolation
// Usage: deno run [permissions] hooks-runner.ts <hooks-file> <event-type> [payload]

import type { HookResponse } from "./schemas/hooks.ts";

// Get command line arguments
const [hooksFile, eventType, payloadArg] = Deno.args;

if (!hooksFile || !eventType) {
  console.error("Usage: hooks-runner.ts <hooks-file> <event-type> [payload]");
  Deno.exit(1);
}

try {
  // Import the hooks configuration
  const hooksModule = await import(`file://${Deno.cwd()}/${hooksFile}`);
  const hooksPlugin = hooksModule.default;

  if (!hooksPlugin || typeof hooksPlugin !== "object") {
    throw new Error("Hooks file must export a default hooks configuration object");
  }

  // Parse payload from argument or stdin
  let payload = {};
  if (payloadArg) {
    try {
      payload = JSON.parse(payloadArg);
    } catch (error) {
      console.warn("Failed to parse payload argument as JSON:", error instanceof Error ? error.message : String(error));
    }
  } else {
    // Try to read from stdin if no payload argument
    try {
      const stdinText = await new Response(Deno.stdin.readable).text();
      if (stdinText.trim()) {
        payload = JSON.parse(stdinText);
      }
    } catch (error) {
      console.warn("Failed to parse stdin as JSON:", error instanceof Error ? error.message : String(error));
    }
  }

  // Execute the appropriate hook handler
  let result: HookResponse = { action: "continue" };
  const hookHandler = hooksPlugin["on" + eventType];

  if (typeof hookHandler === 'function') {
    try {
      result = await hookHandler(payload) || { action: "continue" };
    } catch (error) {
      result = {
        action: "continue",
        message: `Hook execution error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  } else {
    result = {
      action: "continue",
      message: `No handler found for event type: ${eventType}`
    };
  }

  // Output the result
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(`Failed to execute hook: ${error instanceof Error ? error.message : String(error)}`);
  Deno.exit(1);
}