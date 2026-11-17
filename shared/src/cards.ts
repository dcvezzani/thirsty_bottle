import { z } from 'zod';

/** A metadata value: text, number, boolean or list of text. */
export const MetaValueSchema = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(500)).max(100),
]);
export type MetaValue = z.infer<typeof MetaValueSchema>;

export const MetaTypeSchema = z.enum(['text', 'number', 'boolean', 'list']);
export type MetaType = z.infer<typeof MetaTypeSchema>;

const metaKey = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[^\s].*$/, 'key must not start with whitespace');

/** Descriptive ability entry. Displayed only, never executed. */
export const AbilitySchema = z.object({
  trigger: z.string().max(100),
  effect: z.string().max(100),
  value: z.union([z.number().finite(), z.string().max(100)]).optional(),
  target: z.string().max(100),
});
export type Ability = z.infer<typeof AbilitySchema>;

/** Image ids are content hashes (sha256 hex). */
export const ImageIdSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const CardDefSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  description: z.string().max(4000).optional(),
  frontImageId: ImageIdSchema.optional(),
  backImageId: ImageIdSchema.optional(),
  count: z.number().int().min(1).max(500),
  metadata: z.record(metaKey, MetaValueSchema).default({}),
  abilities: z.array(AbilitySchema).max(20).optional(),
});
export type CardDef = z.infer<typeof CardDefSchema>;

export const PropertyTemplateSchema = z.array(z.object({ key: metaKey, type: MetaTypeSchema })).max(50);
export type PropertyTemplate = z.infer<typeof PropertyTemplateSchema>;

/** The content of one deck version (what is saved, cloned, exported and loaded onto tables). */
export const DeckContentSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(4000).optional(),
    backImageId: ImageIdSchema.optional(),
    propertyTemplate: PropertyTemplateSchema.default([]),
    cards: z.array(CardDefSchema).max(1000),
  })
  .superRefine((d, ctx) => {
    const seen = new Set<string>();
    d.cards.forEach((c, i) => {
      if (seen.has(c.id)) ctx.addIssue({ code: 'custom', path: ['cards', i, 'id'], message: 'duplicate card id' });
      seen.add(c.id);
    });
    const total = d.cards.reduce((n, c) => n + c.count, 0);
    if (total > 2000) ctx.addIssue({ code: 'custom', path: ['cards'], message: 'deck exceeds 2000 card instances' });
  });
export type DeckContent = z.infer<typeof DeckContentSchema>;

export type DeckStatus = 'active' | 'archived';
export type DeckVisibility = 'private' | 'link' | 'public';

/** Deck summary as returned by the deck API. */
export interface DeckSummary {
  id: string;
  ownerId: string | null;
  ownerName: string | null;
  name: string;
  description?: string;
  status: DeckStatus;
  visibility: DeckVisibility;
  builtIn: boolean;
  shareToken?: string | null;
  clonedFromLabel?: string | null;
  cloneCount: number;
  cardCount: number;
  definitionCount: number;
  coverImageId?: string | null;
  currentVersionId: string;
  hasDraft?: boolean;
  updatedAt: number;
  archivedAt?: number | null;
}

export interface DeckDetail extends DeckSummary {
  content: DeckContent;
  /** Present only for the owner when an unsaved draft exists. */
  draft?: DeckContent | null;
}

export function cardLabel(def: Pick<CardDef, 'name'>, copyNo: number, copyOf: number): string {
  return copyOf > 1 ? `${def.name} #${copyNo}` : def.name;
}

export function totalInstances(content: Pick<DeckContent, 'cards'>): number {
  return content.cards.reduce((n, c) => n + c.count, 0);
}
