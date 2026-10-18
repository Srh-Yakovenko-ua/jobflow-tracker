import { z } from 'zod';

const hexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const colorSchema = z.object({
  oklch: z.string().regex(/^oklch\(.+\)$/),
  hex: hexSchema,
});

function withoutMeta(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('$')));
}

function tokenRecord<T extends z.ZodType>(entry: T) {
  return z.preprocess(withoutMeta, z.record(z.string(), entry));
}

const familySchema = z.object({ family: z.string().min(1) });

const typeSchema = z.object({
  size: z.number().positive(),
  lineHeight: z.number().positive(),
  weight: z.int(),
  tracking: z.string().optional(),
});

const controlSchema = z.object({
  height: z.number(),
  radius: z.number(),
  fontSize: z.number(),
  padX: z.number(),
});

const iosShadowSchema = z.object({
  shadowColor: hexSchema,
  shadowOpacity: z.number(),
  shadowRadius: z.number(),
  shadowOffset: z.object({ width: z.number(), height: z.number() }),
});

const shadowSchema = z.object({
  web: z.string().min(1),
  rn: z.object({ ios: iosShadowSchema, android: z.object({ elevation: z.number() }) }),
});

const elevationSchema = z.object({
  flat: z.object({
    web: z.string().min(1),
    rn: z.object({ borderWidth: z.number(), borderColor: hexSchema }),
  }),
  e1: shadowSchema,
  e2: shadowSchema,
  e3: shadowSchema,
  accent: shadowSchema,
  focus: z.object({ web: z.string().min(1) }),
});

const durationSchema = z.object({ duration: z.int().nonnegative() });

const motionSchema = z.object({
  instant: durationSchema,
  fast: durationSchema,
  base: durationSchema,
  spring: durationSchema.extend({ easing: z.string().min(1) }),
  data: durationSchema.extend({ easing: z.string().min(1), stagger: z.int().nonnegative() }),
  easing: z.string().min(1),
});

const tokensSchema = z.object({
  color: tokenRecord(colorSchema),
  outcome: tokenRecord(colorSchema),
  stage: tokenRecord(colorSchema),
  dataViz: tokenRecord(colorSchema),
  dark: tokenRecord(colorSchema),
  font: z.object({ display: familySchema, ui: familySchema, mono: familySchema }),
  type: tokenRecord(typeSchema),
  space: tokenRecord(z.number().nonnegative()),
  radius: tokenRecord(z.number().nonnegative()),
  control: tokenRecord(controlSchema),
  elevation: elevationSchema,
  motion: motionSchema,
  dataRules: z.object({
    minSampleForPercent: z.int(),
    minSampleForInsight: z.int(),
    minSampleForForecast: z.int(),
  }),
});

export type Tokens = z.infer<typeof tokensSchema>;

export type ColorToken = z.infer<typeof colorSchema>;

export function parseTokens(input: unknown): Tokens {
  return tokensSchema.parse(input);
}
