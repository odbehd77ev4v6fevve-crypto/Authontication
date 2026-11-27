import { z } from 'zod';

/**
 * Recursively unwraps `.default(...)` wrappers from a Zod v4 schema so that
 * omitted fields on PATCH / partial updates remain `undefined` instead of
 * silently injecting defaults over existing persisted database values.
 */
export function stripSchemaDefaults(schema: unknown): z.ZodTypeAny {
  const zodSchema = schema as z.ZodTypeAny & {
    _zod?: { def?: { type?: string; innerType?: unknown } };
    shape?: Record<string, unknown>;
  };
  const def = zodSchema?._zod?.def;
  if (!def) {
    return zodSchema;
  }

  if (def.type === 'default' && def.innerType) {
    return stripSchemaDefaults(def.innerType);
  }

  if (def.type === 'optional' && def.innerType) {
    return stripSchemaDefaults(def.innerType).optional();
  }

  if (def.type === 'nullable' && def.innerType) {
    return stripSchemaDefaults(def.innerType).nullable();
  }

  if (def.type === 'object' && zodSchema.shape) {
    const nextShape: Record<string, z.ZodTypeAny> = {};
    for (const [key, value] of Object.entries(zodSchema.shape)) {
      nextShape[key] = stripSchemaDefaults(value);
    }
    return z.object(nextShape);
  }

  return zodSchema;
}

/**
 * Builds a partial PATCH schema from a base Zod object schema without
 * preserving `.default(...)` injectors on omitted keys.
 */
export function toPatchSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodType<Partial<z.infer<z.ZodObject<T>>>> {
  const stripped = stripSchemaDefaults(schema) as z.ZodObject<z.ZodRawShape>;
  return stripped.partial() as unknown as z.ZodType<Partial<z.infer<z.ZodObject<T>>>>;
}
