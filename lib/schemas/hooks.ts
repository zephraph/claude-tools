import { z } from "zod";

// Common context schema used across all payloads
const ContextSchema = z.object({
  session_id: z.string(),
  user_id: z.string().optional(),
  working_directory: z.string(),
});

// Hook event payload schemas
export const PreToolUsePayloadSchema = z.object({
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  context: ContextSchema,
});

export const PostToolUsePayloadSchema = z.object({
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  tool_output: z.unknown(),
  context: ContextSchema,
});

export const NotificationPayloadSchema = z.object({
  type: z.enum(["permission_request", "idle", "error"]),
  message: z.string(),
  context: ContextSchema,
});

export const UserPromptSubmitPayloadSchema = z.object({
  prompt: z.string(),
  context: ContextSchema,
});

export const StopPayloadSchema = z.object({
  reason: z.enum(["completed", "error", "interrupted"]),
  context: ContextSchema,
});

export const SubagentStopPayloadSchema = z.object({
  subagent_type: z.string(),
  reason: z.enum(["completed", "error", "interrupted"]),
  context: ContextSchema,
});

export const PreCompactPayloadSchema = z.object({
  context_size: z.number(),
  context: ContextSchema,
});

export const SessionStartPayloadSchema = z.object({
  context: ContextSchema,
});

// Hook response schema
export const HookResponseSchema = z.object({
  action: z.enum(["continue", "block", "modify"]),
  message: z.string().optional(),
  modified_input: z.record(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
});

// Base hook configuration
export const HookConfigSchema = z.object({
  type: z.literal("command"),
  command: z.string(),
  timeout: z.number().optional(),
});

// Tool matcher for targeting specific tools
export const ToolMatcherSchema = z.object({
  matcher: z.string(), // Regex pattern to match tool names
  hooks: z.array(HookConfigSchema),
});

// Event hook wrapper (no matcher, just hooks array)
export const EventHookWrapperSchema = z.object({
  hooks: z.array(HookConfigSchema),
});

// Event-specific schemas
export const PreToolUseHookSchema = z.object({
  PreToolUse: z.array(ToolMatcherSchema),
});

export const PostToolUseHookSchema = z.object({
  PostToolUse: z.array(ToolMatcherSchema),
});

export const NotificationHookSchema = z.object({
  Notification: z.array(EventHookWrapperSchema),
});

export const UserPromptSubmitHookSchema = z.object({
  UserPromptSubmit: z.array(EventHookWrapperSchema),
});

export const StopHookSchema = z.object({
  Stop: z.array(EventHookWrapperSchema),
});

export const SubagentStopHookSchema = z.object({
  SubagentStop: z.array(EventHookWrapperSchema),
});

export const PreCompactHookSchema = z.object({
  PreCompact: z.array(EventHookWrapperSchema),
});

export const SessionStartHookSchema = z.object({
  SessionStart: z.array(EventHookWrapperSchema),
});

// Union of all hook event types
export const HookEventSchema = z.union([
  PreToolUseHookSchema,
  PostToolUseHookSchema,
  NotificationHookSchema,
  UserPromptSubmitHookSchema,
  StopHookSchema,
  SubagentStopHookSchema,
  PreCompactHookSchema,
  SessionStartHookSchema,
]);

// Complete hooks configuration
export const HooksConfigSchema = z.object({
  hooks: z.object({
    PreToolUse: z.array(ToolMatcherSchema).optional(),
    PostToolUse: z.array(ToolMatcherSchema).optional(),
    Notification: z.array(EventHookWrapperSchema).optional(),
    UserPromptSubmit: z.array(EventHookWrapperSchema).optional(),
    Stop: z.array(EventHookWrapperSchema).optional(),
    SubagentStop: z.array(EventHookWrapperSchema).optional(),
    PreCompact: z.array(EventHookWrapperSchema).optional(),
    SessionStart: z.array(EventHookWrapperSchema).optional(),
  }),
});

// Types derived from schemas
export type HookConfig = z.infer<typeof HookConfigSchema>;
export type ToolMatcher = z.infer<typeof ToolMatcherSchema>;
export type HooksConfig = z.infer<typeof HooksConfigSchema>;

// Payload types derived from schemas
export type PreToolUsePayload = z.infer<typeof PreToolUsePayloadSchema>;
export type PostToolUsePayload = z.infer<typeof PostToolUsePayloadSchema>;
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;
export type UserPromptSubmitPayload = z.infer<
  typeof UserPromptSubmitPayloadSchema
>;
export type StopPayload = z.infer<typeof StopPayloadSchema>;
export type SubagentStopPayload = z.infer<typeof SubagentStopPayloadSchema>;
export type PreCompactPayload = z.infer<typeof PreCompactPayloadSchema>;
export type SessionStartPayload = z.infer<typeof SessionStartPayloadSchema>;

// Response type derived from schema
export type HookResponse = z.infer<typeof HookResponseSchema>;

// Hook event types
export type HookEventType =
  | "PreToolUse"
  | "PostToolUse"
  | "Notification"
  | "UserPromptSubmit"
  | "Stop"
  | "SubagentStop"
  | "PreCompact"
  | "SessionStart";

// Options for different hook types
export interface PreToolUseOptions {
  matcher: string;
  command: string;
  timeout?: number;
}

export interface PostToolUseOptions {
  matcher: string;
  command: string;
  timeout?: number;
}

export interface SimpleHookOptions {
  command: string;
  timeout?: number;
}
