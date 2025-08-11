import { z } from "zod";
import {
  type HookResponse,
  HookResponseSchema,
  type NotificationPayload,
  NotificationPayloadSchema,
  type Permissions,
  PermissionSchema,
  type PostToolUsePayload,
  PostToolUsePayloadSchema,
  type PreCompactPayload,
  PreCompactPayloadSchema,
  type PreToolUsePayload,
  PreToolUsePayloadSchema,
  type SessionStartPayload,
  SessionStartPayloadSchema,
  type StopPayload,
  StopPayloadSchema,
  type SubagentStopPayload,
  SubagentStopPayloadSchema,
  type UserPromptSubmitPayload,
  UserPromptSubmitPayloadSchema,
} from "./schemas/index.ts";

export interface HooksPlugin {
  name: string;
  version?: string;
  description?: string;

  // Hook handlers
  onPreToolUse?: (
    payload: PreToolUsePayload,
  ) => Promise<HookResponse> | HookResponse;
  onPostToolUse?: (
    payload: PostToolUsePayload,
  ) => Promise<HookResponse> | HookResponse;
  onNotification?: (
    payload: NotificationPayload,
  ) => Promise<HookResponse> | HookResponse;
  onUserPromptSubmit?: (
    payload: UserPromptSubmitPayload,
  ) => Promise<HookResponse> | HookResponse;
  onStop?: (payload: StopPayload) => Promise<HookResponse> | HookResponse;
  onSubagentStop?: (
    payload: SubagentStopPayload,
  ) => Promise<HookResponse> | HookResponse;
  onPreCompact?: (
    payload: PreCompactPayload,
  ) => Promise<HookResponse> | HookResponse;
  onSessionStart?: (
    payload: SessionStartPayload,
  ) => Promise<HookResponse> | HookResponse;

  // Lifecycle
  onLoad?: () => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
}

export class HooksManager {
  private plugins: HooksPlugin[] = [];
  private permissions?: Permissions = {};

  constructor(config?: { plugins?: HooksPlugin[]; permissions?: Permissions }) {
    this.plugins = config?.plugins || [];
    this.permissions = config?.permissions;
  }

  // Add a plugin to the manager
  use(plugin: HooksPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  // Generate the Claude hooks configuration
  generateHooksConfig() {
    const config: Record<string, unknown> = {};

    // Create catchall hooks for each event type
    const events = [
      "PreToolUse",
      "PostToolUse",
      "Notification",
      "UserPromptSubmit",
      "Stop",
      "SubagentStop",
      "PreCompact",
      "SessionStart",
    ];

    for (const event of events) {
      config[event] = [{
        matcher: "",
        hooks: [{
          type: "command",
          command: `claude-tools run hooks.ts ${event}`,
        }],
      }];
    }

    return { hooks: config };
  }

  // Execute hooks for a specific event
  async executeHooks(
    eventType: string,
    payload: unknown,
  ): Promise<HookResponse[]> {
    const results: HookResponse[] = [];

    // Validate and parse payload based on event type
    let validatedPayload: unknown;
    try {
      switch (eventType) {
        case "PreToolUse":
          validatedPayload = PreToolUsePayloadSchema.parse(payload);
          break;
        case "PostToolUse":
          validatedPayload = PostToolUsePayloadSchema.parse(payload);
          break;
        case "Notification":
          validatedPayload = NotificationPayloadSchema.parse(payload);
          break;
        case "UserPromptSubmit":
          validatedPayload = UserPromptSubmitPayloadSchema.parse(payload);
          break;
        case "Stop":
          validatedPayload = StopPayloadSchema.parse(payload);
          break;
        case "SubagentStop":
          validatedPayload = SubagentStopPayloadSchema.parse(payload);
          break;
        case "PreCompact":
          validatedPayload = PreCompactPayloadSchema.parse(payload);
          break;
        case "SessionStart":
          validatedPayload = SessionStartPayloadSchema.parse(payload);
          break;
        default:
          throw new Error(`Unknown event type: ${eventType}`);
      }
    } catch (error) {
      console.error(`Invalid payload for event ${eventType}:`, error);
      return [{
        action: "continue",
        message: `Invalid payload: ${error instanceof Error ? error.message : String(error)}`,
      }];
    }

    for (const plugin of this.plugins) {
      try {
        await plugin.onLoad?.();

        let result: HookResponse | undefined;

        switch (eventType) {
          case "PreToolUse":
            result = await plugin.onPreToolUse?.(
              validatedPayload as PreToolUsePayload,
            );
            break;
          case "PostToolUse":
            result = await plugin.onPostToolUse?.(
              validatedPayload as PostToolUsePayload,
            );
            break;
          case "Notification":
            result = await plugin.onNotification?.(
              validatedPayload as NotificationPayload,
            );
            break;
          case "UserPromptSubmit":
            result = await plugin.onUserPromptSubmit?.(
              validatedPayload as UserPromptSubmitPayload,
            );
            break;
          case "Stop":
            result = await plugin.onStop?.(validatedPayload as StopPayload);
            break;
          case "SubagentStop":
            result = await plugin.onSubagentStop?.(
              validatedPayload as SubagentStopPayload,
            );
            break;
          case "PreCompact":
            result = await plugin.onPreCompact?.(
              validatedPayload as PreCompactPayload,
            );
            break;
          case "SessionStart":
            result = await plugin.onSessionStart?.(
              validatedPayload as SessionStartPayload,
            );
            break;
        }

        if (result) {
          // Validate the hook response
          try {
            const validatedResult = HookResponseSchema.parse(result);
            results.push(validatedResult);
            if (validatedResult.action === "block") {
              break; // Stop processing if any plugin blocks
            }
          } catch (error) {
            console.error(
              `Invalid response from plugin ${plugin.name}:`,
              error,
            );
            results.push({
              action: "continue",
              message: `Plugin returned invalid response: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }
      } catch (error) {
        console.error(`Plugin ${plugin.name} error:`, error);
        results.push({
          action: "continue",
          message: `Plugin error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return results;
  }

  getPlugins(): HooksPlugin[] {
    return [...this.plugins];
  }
}

// Type for the new hooks API configuration
export interface HooksConfig {
  permissions?: z.infer<typeof PermissionSchema>;
  plugins?: HooksPlugin[];
  onPreToolUse?: (
    payload: PreToolUsePayload,
  ) => Promise<HookResponse> | HookResponse;
  onPostToolUse?: (
    payload: PostToolUsePayload,
  ) => Promise<HookResponse> | HookResponse;
  onNotification?: (
    payload: NotificationPayload,
  ) => Promise<HookResponse> | HookResponse;
  onUserPromptSubmit?: (
    payload: UserPromptSubmitPayload,
  ) => Promise<HookResponse> | HookResponse;
  onStop?: (payload: StopPayload) => Promise<HookResponse> | HookResponse;
  onSubagentStop?: (
    payload: SubagentStopPayload,
  ) => Promise<HookResponse> | HookResponse;
  onPreCompact?: (
    payload: PreCompactPayload,
  ) => Promise<HookResponse> | HookResponse;
  onSessionStart?: (
    payload: SessionStartPayload,
  ) => Promise<HookResponse> | HookResponse;
}

// Main hooks API function
export function hooks(
  { plugins, permissions, ...config }: HooksConfig,
): HooksManager {
  const plugin: HooksPlugin = {
    name: "inline-hooks",
    version: "0.0.0",
    ...config,
  };

  return new HooksManager({
    permissions,
    plugins: [plugin, ...(plugins || [])],
  });
}
