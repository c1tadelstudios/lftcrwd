export type Exercise = {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  notes?: string;
};

export type WorkoutDay = {
  day: number;
  name: string;
  slug: string;
  exercises: Exercise[];
  cardio?: string;
  core?: Exercise[];
};

export const WORKOUT_PLAN: WorkoutDay[] = [
  {
    day: 1,
    name: 'Upper Body',
    slug: 'upper',
    cardio: '20–25 min steady state',
    exercises: [
      { name: 'Incline Dumbbell Press', sets: 4, repsMin: 6, repsMax: 8 },
      { name: 'Flat Machine Chest Press', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Lat Pulldown', sets: 4, repsMin: 8, repsMax: 10 },
      { name: 'T-Bar Row', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Dumbbell Lateral Raises', sets: 4, repsMin: 12, repsMax: 15 },
      { name: 'Tricep Pushdowns', sets: 3, repsMin: 10, repsMax: 12 },
      { name: 'EZ Bar Curls', sets: 3, repsMin: 10, repsMax: 12 },
    ],
  },
  {
    day: 2,
    name: 'Lower Body',
    slug: 'lower',
    exercises: [
      { name: 'Trap Bar Deadlift', sets: 4, repsMin: 6, repsMax: 8, notes: 'or Barbell Deadlift' },
      { name: 'Squat', sets: 3, repsMin: 8, repsMax: 10, notes: 'or Hack Squat' },
      { name: 'Romanian Deadlift', sets: 3, repsMin: 8, repsMax: 10, notes: 'Moderate weight' },
      { name: 'Leg Press', sets: 3, repsMin: 10, repsMax: 12 },
      { name: 'Seated Hamstring Curl', sets: 3, repsMin: 10, repsMax: 12 },
      { name: 'Standing Calf Raises', sets: 4, repsMin: 12, repsMax: 15 },
    ],
    core: [
      { name: 'Lying Leg Raises', sets: 3, repsMin: 12, repsMax: 15 },
      { name: 'Cable Crunch', sets: 3, repsMin: 12, repsMax: 15 },
      { name: 'Plank', sets: 3, repsMin: 30, repsMax: 45, notes: 'seconds' },
    ],
  },
  {
    day: 3,
    name: 'Push',
    slug: 'push',
    cardio: '20–30 min steady state',
    exercises: [
      { name: 'Cable or Pec Deck Fly', sets: 3, repsMin: 12, repsMax: 15 },
      { name: 'Smith Machine Incline Press', sets: 4, repsMin: 8, repsMax: 12 },
      { name: 'Machine Shoulder Press', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Machine Lateral Raises', sets: 5, repsMin: 12, repsMax: 20 },
      { name: 'Overhead Tricep Extension', sets: 3, repsMin: 10, repsMax: 12 },
      { name: 'Weighted Dips', sets: 3, repsMin: 8, repsMax: 12, notes: 'or Dip Machine' },
    ],
  },
  {
    day: 4,
    name: 'Pull',
    slug: 'pull',
    exercises: [
      { name: 'Straight Arm Cable Pulldown', sets: 3, repsMin: 12, repsMax: 15 },
      { name: 'Single Arm Lat Pulldown', sets: 3, repsMin: 10, repsMax: 12, notes: 'Machine or Cable' },
      { name: 'High Row', sets: 3, repsMin: 10, repsMax: 12, notes: 'Elbows up/out' },
      { name: 'Single Arm Low Cable Row', sets: 3, repsMin: 10, repsMax: 12 },
      { name: 'Rear Delt Fly', sets: 4, repsMin: 15, repsMax: 20 },
      { name: 'Alternating Dumbbell Hammer Curls', sets: 3, repsMin: 10, repsMax: 12 },
      { name: 'Preacher Curls', sets: 3, repsMin: 10, repsMax: 12 },
    ],
    core: [
      { name: 'Lying Leg Raises', sets: 3, repsMin: 12, repsMax: 15 },
      { name: 'Ab Crunch Machine', sets: 3, repsMin: 12, repsMax: 15 },
      { name: 'Plank', sets: 3, repsMin: 30, repsMax: 45, notes: 'seconds' },
    ],
  },
  {
    day: 5,
    name: 'Legs',
    slug: 'legs',
    cardio: '20–30 min steady state',
    exercises: [
      { name: 'Lying Hamstring Curl', sets: 3, repsMin: 12, repsMax: 15, notes: 'Superset with Abduction Machine' },
      { name: 'Abduction Machine', sets: 3, repsMin: 15, repsMax: 20, notes: 'Superset with Lying Hamstring Curl' },
      { name: 'Sumo Squat (Pit Shark Machine)', sets: 3, repsMin: 10, repsMax: 12 },
      { name: 'Single-Leg Press', sets: 3, repsMin: 12, repsMax: 15, notes: 'Each leg' },
      { name: 'Hip Thrust / Glute Drive Machine', sets: 3, repsMin: 10, repsMax: 12 },
      { name: 'Leg Extension', sets: 3, repsMin: 15, repsMax: 15 },
      { name: 'Seated or Standing Calf Raises', sets: 4, repsMin: 12, repsMax: 15 },
    ],
  },
];

export const NUTRITION = {
  calories: { min: 2300, max: 2500 },
  protein: 190,
  carbs: { min: 240, max: 270 },
  fats: { min: 60, max: 70 },
  waterGallons: 1,
  creatineG: 5,
  meals: [
    {
      name: 'Meal 1 – Breakfast / Pre-Workout',
      items: [
        '1 scoop whey protein isolate',
        '¾ cup dry oatmeal',
        '1 tbsp peanut butter',
        '5g creatine',
        'Water or unsweetened almond milk',
      ],
    },
    {
      name: 'Meal 2 – Lunch / Post-Workout',
      items: [
        'Protein: 6 oz chicken, white fish, shrimp, or 5 oz lean ground beef (90/10)',
        'Carbs: 1–1.5 cups cooked jasmine rice',
        'Veggies: 1–2 cups (green beans, broccoli, spinach)',
        'Fats: Keep LOW in this meal',
      ],
    },
    {
      name: 'Meal 3 – Dinner',
      items: [
        'Protein: 6 oz chicken, fish, shrimp, or 5 oz lean ground beef',
        'Carbs: 1 cup cooked rice OR 1 medium potato OR sweet potato',
        'Fats: 1 tbsp olive oil OR ¼–½ avocado',
        'Veggies: 1–2 cups',
      ],
    },
    {
      name: 'Meal 4 – Protein Shake',
      items: [
        '1–1.5 scoops whey protein isolate',
        '1 banana OR 1 cup berries',
        'Optional: greens + fiber',
      ],
    },
    {
      name: 'Optional – If Hungry',
      items: [
        '2 rice cakes + 1 tbsp nut butter',
        'OR Greek yogurt + berries',
      ],
    },
  ],
};

export const DAILY_TARGETS = {
  proteinG: 190,
  waterGallons: 1,
  steps: { min: 7500, max: 10000 },
  creatineG: 5,
  workoutsPerWeek: 5,
  cardioPerWeek: { min: 3, max: 4 },
};
