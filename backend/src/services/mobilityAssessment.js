// Real, honest scope: Claude's API analyzes images, not raw video, so the
// "mobility test" is a set of frames pulled from short recorded movements,
// not a live-tracked video. This gets a genuine qualitative movement
// assessment from a real model call -- not a numeric range-of-motion
// measurement (that needs a dedicated pose-estimation pipeline, a separate
// and much bigger project -- see ROADMAP Phase 3). The 0-100 "scores" below
// are the same idea: a visual trend estimate for the dashboard, not a
// clinical measurement.
const { generateVisionText, isAvailable } = require('./llmClient');

// Five recorded movements covering foot/ankle, knee, hip, shoulder, and
// overall movement quality/balance -- grouped from a longer list of
// individual test points so an athlete records 5 short clips, not 12.
const MOBILITY_TEST_POSES = [
  {
    key: 'foot_ankle', label: 'Foot & Ankle Control',
    instructions: 'Rise onto your toes and lower slowly 3 times, then balance on one foot for 5 seconds and switch sides.',
  },
  {
    key: 'knee_squat', label: 'Knee Movement & Strength',
    instructions: 'Perform 3 slow bodyweight squats, then a few slow step-downs from a low step or curb on each leg if you have one available.',
  },
  {
    key: 'hip_mobility', label: 'Hip Mobility & Stability',
    instructions: 'Perform a few hip circles in each direction, then hold a deep lunge stretch on each side.',
  },
  {
    key: 'shoulder_mobility', label: 'Shoulder Mobility & Strength',
    instructions: 'Raise both arms in a full circle overhead 3 times, then hold your arms straight out to the sides for a few seconds.',
  },
  {
    key: 'movement_quality', label: 'Overall Movement & Balance',
    instructions: 'Jog in place for a few seconds, change direction quickly a couple of times, then finish with a brief single-leg balance. Feel free to include a movement common in your sport.',
  },
];

// Matches routineGenerator's category/focus_tag vocabulary so a flagged
// limitation can directly bias pose selection via the existing tagMatches().
// This isn't just "which body part looked tight" -- it's the training focus
// that actually addresses the underlying weakness behind what was observed
// (e.g. knee valgus reflects weak hip abductors/external rotators, so it
// should flag strength + balance, not just hip_opener). Real limit: the
// pose library has no dedicated foot/ankle tag, so findings there show up
// in the written assessment (and to the coach) but can't bias pose
// selection the way the tags below can -- noted honestly, not pretended.
const LIMITATION_TAGS = [
  'hip_opener', 'hamstring', 'shoulder_opener', 'spine_mobility', 'balance',
  'core', 'chest_opener', 'strength', 'posture', 'arm_balance', 'twist',
];
const TREND_VALUES = ['improved', 'same', 'regressed'];
const SCORE_KEYS = ['strength', 'mobility', 'stability', 'flexibility', 'balance', 'movement_control', 'athletic_performance'];

function fieldByKey(key) {
  return MOBILITY_TEST_POSES.find((p) => p.key === key);
}

const BIOMECHANICS_CHECKLIST = `
Assess each movement using the specific criteria a strength coach or physical therapist would actually check for --
be concrete about what you observe, not generic:

- Foot/ankle (rise onto toes, single-leg balance): arch behavior under load (collapsing/pronating vs. holding
  shape), ankle dorsiflexion range, eversion/inversion control, calf-raise symmetry between sides, postural sway
  or hip drop during single-leg balance (a Trendelenburg-type sign of poor hip/glute control).
- Knee (bodyweight squats, step-downs): knee valgus (knees caving inward) vs. varus, knee tracking relative to
  the toes, squat depth achieved, trunk lean/forward flexion, heel lift (often indicates limited ankle
  dorsiflexion, not a knee problem itself), left/right symmetry on the step-down, control on the eccentric
  (lowering) phase.
- Hip (hip circles, deep lunge): apparent hip flexor length/tightness (limited lunge depth or excessive lumbar
  arch to compensate), rotational range in the circles, pelvic control (tilting/hiking), side-to-side asymmetry.
- Shoulder (overhead arm circles, side-arm hold): scapular control (winging or excessive shrug to compensate),
  overhead reach symmetry, thoracic spine contribution to overhead range vs. pure shoulder motion, fatigue/shake
  during the static hold (endurance, not just range).
- Overall movement/balance (jog, direction change, single-leg finish): deceleration control, coordination
  through the direction change, dynamic balance and core stability, general movement confidence, and how any
  sport-specific movement shown reflects the demands of their sport.
`;

// Turns the athlete's written-assessment answers into instructions that
// change WHAT the model looks for, not just narration bolted onto the
// output -- the mobility test is downstream of the written assessment, so a
// soccer player's ankle stability under load or a swimmer's overhead
// shoulder range should get real weight, and a flagged past/current injury
// should sharpen scrutiny of that specific joint rather than being ignored.
function buildAthleteContextBlock(ctx) {
  if (!ctx) return '';
  const lines = [];
  if (ctx.sport && ctx.sport.toLowerCase() !== 'none') {
    let sportLine = `Sport: ${ctx.sport}`;
    if (ctx.athleticPosition && ctx.athleticPosition.toLowerCase() !== 'n/a') sportLine += ` (position/event: ${ctx.athleticPosition})`;
    if (ctx.seasonPhase) sportLine += `, currently in ${ctx.seasonPhase.replace('_', ' ')}`;
    lines.push(sportLine);
  }
  if (ctx.primaryAthleticGoal) lines.push(`Primary training goal: ${ctx.primaryAthleticGoal.replace(/_/g, ' ')}`);
  const injuries = [...(ctx.pastInjuries || []), ...(ctx.currentInjuries || [])].filter((v) => v && v.toLowerCase() !== 'none');
  if (injuries.length) lines.push(`Injury history: ${injuries.join('; ')}`);
  if (ctx.jointPain) {
    const painPoints = Object.entries(ctx.jointPain).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k}=${v}/5`);
    if (painPoints.length) lines.push(`Current joint pain: ${painPoints.join(', ')}`);
  }
  if (ctx.currentFlexibility) lines.push(`Self-reported flexibility: ${ctx.currentFlexibility}`);
  if (ctx.currentMobility) lines.push(`Self-reported joint mobility: ${ctx.currentMobility}`);
  if (!lines.length) return '';

  return '\nThe athlete\'s written intake answers (use these to focus your assessment -- weight the movements '
    + 'and compensation patterns most relevant to their sport and position more heavily, pay closer attention to '
    + 'any joint tied to a reported injury or pain, and frame limitations in terms of their stated training goal):\n'
    + lines.map((l) => `- ${l}`).join('\n') + '\n';
}

function buildSystem(hasPrevious, athleteContext) {
  let system = 'You are an experienced strength & conditioning coach and movement specialist assessing an '
    + 'athlete\'s mobility, stability, and movement quality from frames of them performing a set of movements. '
    + 'Apply real biomechanical reasoning -- name the specific compensation patterns and asymmetries you can '
    + 'actually see, the way an experienced coach would, not generic encouragement. This is a visual impression '
    + 'from a few frames, not a clinical diagnosis or a goniometer measurement -- never state exact degrees or '
    + 'numbers you can\'t actually see, and don\'t present this as a substitute for an in-person evaluation by a '
    + 'certified athletic trainer or physical therapist when something looks like it needs one.\n'
    + buildAthleteContextBlock(athleteContext) + '\n'
    + BIOMECHANICS_CHECKLIST + '\n'
    + 'Respond in this exact structure:\n'
    + '1. A short assessment (4-6 sentences) covering foot/ankle, knee, hip, shoulder, and overall movement '
    + 'quality/balance as relevant to what you can see, naming specific compensation patterns where you spot '
    + 'them (e.g. "knee valgus on the left step-down," "limited ankle dorsiflexion evident from early heel '
    + 'lift," "scapular winging during the overhead hold").\n';

  if (hasPrevious) {
    system += '2. A line starting exactly "PROGRESS:" with 1-3 sentences comparing this test to the athlete\'s '
      + 'previous one (given below) -- what got better, worse, or stayed the same.\n'
      + `3. A line starting exactly "TREND:" with exactly one of: ${TREND_VALUES.join(', ')}.\n`
      + '4. A line starting exactly "LIMITATIONS:" ';
  } else {
    system += '2. A line starting exactly "LIMITATIONS:" ';
  }

  system += `followed by a comma-separated list using ONLY these exact tags: ${LIMITATION_TAGS.join(', ')}. `
    + 'For each tag, choose it because it is the training focus that would actually address the underlying '
    + 'weakness behind what you observed -- reason from cause to correction, not just from body part to '
    + 'matching-sounding tag. Examples: knee valgus or a hip drop during single-leg balance reflects weak hip '
    + 'abductors/external rotators, so flag strength and balance (not just hip_opener); scapular winging or an '
    + 'inability to hold the overhead position reflects poor scapular/shoulder stability, so flag arm_balance '
    + 'alongside shoulder_opener; excessive lumbar arch or forward trunk lean reflects poor core/trunk control, '
    + 'so flag core and posture; limited rotational range in the hip circles suggests thoracic or hip rotation '
    + 'work, so flag twist. Only include a tag when you actually saw the underlying issue -- omit anything you '
    + 'didn\'t observe. If nothing stands out, write "LIMITATIONS: none".\n'
    + `${hasPrevious ? '5' : '3'}. A line starting exactly "SCORES:" followed by comma-separated key=value pairs, `
    + `one for each of exactly these keys: ${SCORE_KEYS.join(', ')}. Each value is your best-effort visual `
    + 'estimate from 0-100 of that quality (0 = severely limited, 100 = excellent), based only on what these '
    + 'movements actually show. Example: "SCORES: strength=65, mobility=70, stability=60, flexibility=72, '
    + 'balance=68, movement_control=64, athletic_performance=66".';

  return system;
}

function parseSection(raw, label) {
  const re = new RegExp(`^${label}:\\s*(.+)$`, 'im');
  const match = raw.match(re);
  return match ? { text: match[1].trim(), index: match.index } : null;
}

function parseScores(raw) {
  const section = parseSection(raw, 'SCORES');
  if (!section) return { scores: null, index: null };

  const scores = {};
  for (const pair of section.text.split(',')) {
    const [rawKey, rawValue] = pair.split('=').map((s) => s && s.trim());
    if (!rawKey || !SCORE_KEYS.includes(rawKey)) continue;
    const n = parseInt(rawValue, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 100) scores[rawKey] = n;
  }
  return { scores: Object.keys(scores).length > 0 ? scores : null, index: section.index };
}

// photos: [{ poseKey, mediaType, data (base64) }]
// previousTest (optional): { assessment, flaggedLimitations } from the
// athlete's last mobility test, to get a genuine before/after comparison
// instead of just a standalone snapshot.
// athleteContext (optional): { sport, athleticPosition, seasonPhase,
// primaryAthleticGoal, pastInjuries, currentInjuries, jointPain,
// currentFlexibility, currentMobility } pulled from the athlete's written
// intake -- the mobility test is intentionally downstream of that
// questionnaire, not a standalone form.
// Returns { unavailable: true } if no LLM is configured, otherwise
// { assessment, flaggedLimitations, progressNote, trend, scores }
// (progressNote/trend are null with no previous test; scores is null if the
// model didn't return a parseable block).
async function assessMobility(photos, previousTest = null, athleteContext = null) {
  if (!isAvailable()) return { unavailable: true, assessment: null, flaggedLimitations: [], progressNote: null, trend: null, scores: null };

  const hasPrevious = !!(previousTest && previousTest.assessment);
  const system = buildSystem(hasPrevious, athleteContext);

  const poseLabels = photos.map((p) => fieldByKey(p.poseKey)?.label || p.poseKey).join(', ');
  let prompt = `These frames show an athlete performing: ${poseLabels}.`;
  if (hasPrevious) {
    prompt += `\n\nTheir previous mobility assessment was: "${previousTest.assessment}"`
      + (previousTest.flaggedLimitations?.length
        ? ` (flagged limitations at the time: ${previousTest.flaggedLimitations.join(', ')})`
        : ' (no limitations flagged at the time)') + '.';
  }

  const images = photos.map((p) => ({ mediaType: p.mediaType, data: p.data }));
  const raw = await generateVisionText({ system, prompt, images, maxTokens: 700 });
  if (!raw) return { unavailable: false, assessment: null, flaggedLimitations: [], progressNote: null, trend: null, scores: null };

  const limitationsSection = parseSection(raw, 'LIMITATIONS');
  let flaggedLimitations = [];
  if (limitationsSection) {
    const list = limitationsSection.text.toLowerCase();
    if (list !== 'none') {
      flaggedLimitations = list.split(',').map((s) => s.trim()).filter((t) => LIMITATION_TAGS.includes(t));
    }
  }

  const { scores, index: scoresIndex } = parseScores(raw);

  let progressNote = null;
  let trend = null;
  let assessmentEnd = raw.length;
  for (const idx of [limitationsSection?.index, scoresIndex]) {
    if (idx !== undefined && idx !== null) assessmentEnd = Math.min(assessmentEnd, idx);
  }

  if (hasPrevious) {
    const trendSection = parseSection(raw, 'TREND');
    if (trendSection && TREND_VALUES.includes(trendSection.text.toLowerCase())) trend = trendSection.text.toLowerCase();

    const progressSection = parseSection(raw, 'PROGRESS');
    if (progressSection) {
      progressNote = progressSection.text;
      assessmentEnd = Math.min(assessmentEnd, progressSection.index);
    }
  }

  const assessment = raw.slice(0, assessmentEnd).trim();

  return { unavailable: false, assessment, flaggedLimitations, progressNote, trend, scores };
}

module.exports = { assessMobility, MOBILITY_TEST_POSES, LIMITATION_TAGS, TREND_VALUES, SCORE_KEYS };
