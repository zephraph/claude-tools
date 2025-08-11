import { z } from "zod";

// Permission schema for controlling Deno permissions
export const PermissionSchema = z.object({
  allow: z.object({
    read: z.union([z.array(z.string()), z.boolean()]).optional(),
    write: z.union([z.array(z.string()), z.boolean()]).optional(),
    net: z.union([z.array(z.string()), z.boolean()]).optional(),
    env: z.union([z.array(z.string()), z.boolean()]).optional(),
    run: z.union([z.array(z.string()), z.boolean()]).optional(),
    sys: z.union([z.array(z.string()), z.boolean()]).optional(),
  }).optional(),
  deny: z.object({
    read: z.array(z.string()).optional(),
    write: z.array(z.string()).optional(),
    net: z.array(z.string()).optional(),
    env: z.array(z.string()).optional(),
    run: z.array(z.string()).optional(),
    sys: z.array(z.string()).optional(),
  }).optional(),
});

export type Permissions = z.infer<typeof PermissionSchema>;
