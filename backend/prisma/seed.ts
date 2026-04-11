import 'dotenv/config'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../src/generated/prisma/client.js'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const exercises = [
  // ─── CHEST ───────────────────────────────────────────────────────────────
  {
    name: 'Barbell Bench Press',
    description: 'Lie on a flat bench and press a barbell from chest level to full arm extension. Primary chest builder.',
  },
  {
    name: 'Incline Barbell Bench Press',
    description: 'Performed on an incline bench (30–45°). Emphasises the upper chest and front deltoids.',
  },
  {
    name: 'Decline Barbell Bench Press',
    description: 'Performed on a decline bench. Targets the lower chest with reduced shoulder involvement.',
  },
  {
    name: 'Dumbbell Bench Press',
    description: 'Like the barbell press but with dumbbells, allowing a greater range of motion and independent arm work.',
  },
  {
    name: 'Incline Dumbbell Press',
    description: 'Dumbbell press on an incline bench. Hits upper chest and front deltoids.',
  },
  {
    name: 'Dumbbell Flyes',
    description: 'Lie flat and arc dumbbells out wide then back together. Stretches and isolates the chest.',
  },
  {
    name: 'Cable Crossover',
    description: 'Using a cable machine, bring handles from wide to crossed in front of you. Great for chest isolation and constant tension.',
  },
  {
    name: 'Chest Dips',
    description: 'Forward-leaning dips on parallel bars. Emphasises lower chest and triceps.',
  },

  // ─── BACK ─────────────────────────────────────────────────────────────────
  {
    name: 'Deadlift',
    description: 'Pull a loaded barbell from the floor to hip height. Compound movement hitting the entire posterior chain.',
  },
  {
    name: 'Barbell Row',
    description: 'Hinge at the hips and row a barbell to your lower chest. One of the best overall back thickness builders.',
  },
  {
    name: 'Dumbbell Single-Arm Row',
    description: 'Brace one hand on a bench and row a dumbbell with the other. Allows heavy loading with full range of motion.',
  },
  {
    name: 'Pull-Up',
    description: 'Overhand grip pull-up. Targets lats, biceps and upper back. Bodyweight compound movement.',
  },
  {
    name: 'Chin-Up',
    description: 'Underhand grip pull-up. Shifts emphasis toward the biceps compared to the pull-up.',
  },
  {
    name: 'Lat Pulldown',
    description: 'Pull a bar down to your chest on a cable machine. Great lat builder and pull-up progression.',
  },
  {
    name: 'Seated Cable Row',
    description: 'Row a cable handle to your abdomen while seated. Builds mid-back thickness.',
  },
  {
    name: 'T-Bar Row',
    description: 'Row a loaded barbell fixed at one end. Heavy compound movement for back thickness.',
  },
  {
    name: 'Face Pull',
    description: 'Pull a rope attachment toward your face on a high cable. Targets rear delts and external rotators.',
  },

  // ─── SHOULDERS ────────────────────────────────────────────────────────────
  {
    name: 'Barbell Overhead Press',
    description: 'Press a barbell from shoulder height to full overhead extension. Primary shoulder strength builder.',
  },
  {
    name: 'Dumbbell Shoulder Press',
    description: 'Press dumbbells overhead from shoulder height. Allows independent arm movement.',
  },
  {
    name: 'Lateral Raise',
    description: 'Raise dumbbells out to the sides to shoulder height. Isolates the medial (side) deltoid.',
  },
  {
    name: 'Front Raise',
    description: 'Raise a dumbbell or plate straight in front to shoulder height. Targets the anterior deltoid.',
  },
  {
    name: 'Rear Delt Fly',
    description: 'Hinge forward and raise dumbbells out to the sides. Isolates the posterior deltoid.',
  },
  {
    name: 'Upright Row',
    description: 'Pull a barbell or dumbbells up along the body to chin height. Works traps and lateral deltoids.',
  },
  {
    name: 'Arnold Press',
    description: 'Dumbbell press with a rotation from a palms-in to palms-out position. Hits all three deltoid heads.',
  },

  // ─── BICEPS ───────────────────────────────────────────────────────────────
  {
    name: 'Barbell Curl',
    description: 'Curl a barbell from full arm extension to the shoulders. Classic bicep mass builder.',
  },
  {
    name: 'Dumbbell Curl',
    description: 'Curl dumbbells alternately or simultaneously. Allows supination through the movement.',
  },
  {
    name: 'Hammer Curl',
    description: 'Curl with a neutral grip (thumbs up). Targets the brachialis and brachioradialis as well as the bicep.',
  },
  {
    name: 'Preacher Curl',
    description: 'Curl performed over a preacher bench pad. Eliminates momentum and isolates the bicep.',
  },
  {
    name: 'Cable Curl',
    description: 'Curl using a low cable pulley. Keeps constant tension on the bicep throughout the movement.',
  },
  {
    name: 'Concentration Curl',
    description: 'Single-arm curl with the elbow braced on the inner thigh. Maximum bicep isolation.',
  },
  {
    name: 'Incline Dumbbell Curl',
    description: 'Curl on an inclined bench. Creates a stretch on the bicep at the start for a greater range of motion.',
  },

  // ─── TRICEPS ──────────────────────────────────────────────────────────────
  {
    name: 'Close-Grip Bench Press',
    description: 'Bench press with hands shoulder-width apart. Shifts emphasis from chest to the triceps.',
  },
  {
    name: 'Skull Crusher',
    description: 'Lower a barbell or dumbbells toward the forehead while lying on a bench. Excellent tricep mass builder.',
  },
  {
    name: 'Tricep Pushdown',
    description: 'Push a cable bar or rope downward to full arm extension. Isolates the tricep, especially the lateral head.',
  },
  {
    name: 'Overhead Tricep Extension',
    description: 'Extend a dumbbell or cable overhead. Puts the long head of the tricep under a strong stretch.',
  },
  {
    name: 'Tricep Dips',
    description: 'Vertical dips with an upright torso. Primarily targets the triceps.',
  },
  {
    name: 'Diamond Push-Up',
    description: 'Push-up with hands close together forming a diamond. Bodyweight tricep exercise.',
  },

  // ─── LEGS ─────────────────────────────────────────────────────────────────
  {
    name: 'Barbell Back Squat',
    description: 'Squat with a barbell across the upper back. The king of lower body exercises — quads, glutes, hamstrings.',
  },
  {
    name: 'Barbell Front Squat',
    description: 'Squat with the barbell resting on the front deltoids. More quad-dominant and upright torso than back squat.',
  },
  {
    name: 'Romanian Deadlift',
    description: 'Hip-hinge movement lowering a barbell along the legs. Primary hamstring and glute builder.',
  },
  {
    name: 'Leg Press',
    description: 'Push a weighted platform away with the feet on a 45° machine. Quad-dominant compound movement.',
  },
  {
    name: 'Hack Squat',
    description: 'Squat on a guided 45° sled. Quad-focused with reduced lower back stress.',
  },
  {
    name: 'Leg Curl',
    description: 'Curl the leg against resistance on a machine. Primary isolation exercise for the hamstrings.',
  },
  {
    name: 'Leg Extension',
    description: 'Extend the leg against resistance on a machine. Isolates the quadriceps.',
  },
  {
    name: 'Bulgarian Split Squat',
    description: 'Single-leg squat with the rear foot elevated on a bench. Builds quads, glutes and improves balance.',
  },
  {
    name: 'Walking Lunge',
    description: 'Step forward into a lunge alternating legs. Works quads, glutes and hamstrings dynamically.',
  },
  {
    name: 'Standing Calf Raise',
    description: 'Rise onto the toes against resistance. Targets the gastrocnemius (upper calf).',
  },
  {
    name: 'Seated Calf Raise',
    description: 'Calf raise while seated. Emphasises the soleus due to the bent-knee position.',
  },
  {
    name: 'Hip Thrust',
    description: 'Bridge with upper back on a bench and barbell across the hips. Best glute isolation exercise.',
  },
  {
    name: 'Sumo Deadlift',
    description: 'Deadlift with a wide stance and vertical torso. Shifts emphasis to the inner thighs and glutes.',
  },

  // ─── CORE ─────────────────────────────────────────────────────────────────
  {
    name: 'Plank',
    description: 'Hold a straight body position on forearms and toes. Anti-extension core stability exercise.',
  },
  {
    name: 'Cable Crunch',
    description: 'Kneel and crunch down on a high cable with a rope. Weighted ab exercise with a full stretch at the top.',
  },
  {
    name: 'Hanging Leg Raise',
    description: 'Hang from a bar and raise straight legs to hip height or above. Targets the lower abs and hip flexors.',
  },
  {
    name: 'Ab Wheel Rollout',
    description: 'Roll an ab wheel from kneeling to a full stretch position. Anti-extension core strength exercise.',
  },
  {
    name: 'Russian Twist',
    description: 'Rotate a weight side to side while seated with feet raised. Targets the obliques.',
  },
]

async function main() {
  console.log(`Seeding ${exercises.length} exercises…`)

  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: {},
      create: exercise,
    })
  }

  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
