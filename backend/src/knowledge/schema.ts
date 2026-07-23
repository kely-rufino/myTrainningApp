import { z } from 'zod'
import { GOALS } from '../lib/trainingVocab.js'

// Schema for the versioned training-guidelines rule file. The whole point of
// the file is traceability: every variable carries an evidence tier and at
// least one citation, and the loader refuses a file that doesn't validate —
// a number nobody can source has no business being served by the API.

export const EVIDENCE_TIERS = [
  // Peer-reviewed meta-analysis / systematic review — where the actual
  // numbers come from.
  'meta_analysis',
  // Consolidated peer-reviewed position stand (synthesizes primary work).
  'position_stand',
  // Sound practitioner consensus / biomechanical reasoning — explicitly NOT
  // a measured dose-response variable. Kept distinct so clients can weight it.
  'consensus',
] as const

export const EXPERIENCE_CATEGORIES = ['novice', 'intermediate', 'advanced'] as const
export type ExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number]

const citationSchema = z.object({
  authors: z.string(),
  year: z.number().int(),
  title: z.string(),
  journal: z.string(),
  doi: z.string().nullable(),
  pubmedId: z.string().nullable(),
  url: z.string().url(),
  // What we could actually read when extracting the numbers.
  accessLevel: z.enum(['full_text', 'abstract']),
})

const valueSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  unit: z.string(),
})

const variableSchema = z.object({
  key: z.string().min(1),
  // null = applies to all goals / all experience levels.
  goals: z.array(z.enum(GOALS)).nullable(),
  experience: z.array(z.enum(EXPERIENCE_CATEGORIES)).nullable(),
  value: valueSchema.nullable(), // null for qualitative rules (e.g. ordering)
  recommendation: z.string().min(1), // what the source actually recommends
  finding: z.string().min(1), // the verified finding backing it, with numbers
  evidenceTier: z.enum(EVIDENCE_TIERS),
  citationKeys: z.array(z.string()).min(1),
  caveats: z.array(z.string()),
  // Set when the evidence applies to a specific studied population (e.g.
  // "older adults (65+)") rather than healthy adults generally. Clients must
  // not stretch these rules to other ages/populations.
  population: z.string().optional(),
  // Minimum age the studied population supports. Rules with this set are
  // only served when the user's age is unknown or >= this value.
  appliesFromAge: z.number().int().optional(),
})

export const guidelinesFileSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // App convention for mapping the profile's 1–10 self-assessment onto the
    // literature's novice/intermediate/advanced categories. Recorded in the
    // file (not code) so it's versioned alongside the numbers it selects.
    experienceLevelMapping: z.object({
      novice: z.tuple([z.number().int(), z.number().int()]),
      intermediate: z.tuple([z.number().int(), z.number().int()]),
      advanced: z.tuple([z.number().int(), z.number().int()]),
      note: z.string(),
    }),
    citations: z.record(z.string(), citationSchema),
    variables: z.array(variableSchema).min(1),
  })
  .superRefine((file, ctx) => {
    for (const [i, variable] of file.variables.entries()) {
      for (const key of variable.citationKeys) {
        if (!(key in file.citations)) {
          ctx.addIssue({
            code: 'custom',
            path: ['variables', i, 'citationKeys'],
            message: `Unknown citation key "${key}"`,
          })
        }
      }
    }
  })

export type GuidelinesFile = z.infer<typeof guidelinesFileSchema>
export type GuidelineVariable = z.infer<typeof variableSchema>
export type Citation = z.infer<typeof citationSchema>
