import { z } from "zod";
import { PermissionSchema } from "./permissions.ts";

// Plugin schema
export const PluginSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  permissions: PermissionSchema.optional(),
  // Note: Function validators are omitted as they're not serializable
  // The interface below provides the runtime contract
});

export type Plugin = z.infer<typeof PluginSchema>;
