// Real, honest scope: Claude's API analyzes images, not raw video, so the
// "mobility test" is a small fixed set of stretch-position photos, not a
// recorded video. This gets a genuine qualitative movement assessment from
// a real model call -- not a numeric range-of-motion measurement (that
// needs a dedicated pose-estimation pipeline, a separate and much bigger
// project -- see ROADMAP Phase 3).
const { generateVisionText, isAvailable } = require('./llmClient');

const MOBILITY_TEST_POSES = [
  { key: 'forward_fold', label: 'Standing Forward Fold', instructions: 'Stand with feet hip-width apart, fold forward and reach toward your toes, holding your deepest comfortable stretch.' },
  { key: 'overhead_reach', label: 'Overhead Reach', instructions: 'Stand tall and reach both arms straight overhead as high as comfortable.' },
  { key: 'side_bend', label: 'Side Bend', instructions: 'Stand tall, reach one arm overhead and bend toward the opposite side as far as comfortable.' },
  { key: 'deep_squat', label: 'Deep Bodyweight Squat', instructions: 'Lower into the deepest squat you can hold with your heels flat on the ground.' },
];

// Matches routineGenerator's category/focus_tag vocabulary so a flagged
// limitation can directly bias pose selection via the existing tagMatches().
const LIMITATION_TAGS = ['hip_opener', 'hamstring', 'shoulder_opener', 'spine_mobility', 'balance', 'core', 'chest_opener'];
const TREND_VALUES = ['improved', 'same', 'regressed'];

function fieldByKey(key) {
  return MOBILITY_TEST_POSES.find((p) => p.key === key);
}

function buildSystem(hasPrevious) {
  let system = 'You are a movement coach assessing an athlete\'s mobility from photos of stretch positions. '
    + 'Note visible range of motion, form, and any asymmetry or limitation, in plain direct language a coach '
    + 'could act on immediately. This is a visual impression, not a clinical measurement -- do not state exact '
    + 'degrees or numbers you can\'t actually see.\n\n'
    + 'Respond in this exact structure:\n'
    + '1. A short assessment (3-5 sentences).\n';

  if (hasPrevious) {
    system += '2. A line starting exactly "PROGRESS:" with 1-3 sentences comparing this test to the athlete\'s '
      + 'previous one (given below) -- what got better, worse, or stayed the same.\n'
      + `3. A line starting exactly "TREND:" with exactly one of: ${TREND_VALUES.join(', ')}.\n`
      + '4. A line starting exactly "LIMITATIONS:" ';
  } else {
    system += '2. A line starting exactly "LIMITATIONS:" ';
  }

  system += `followed by a comma-separated list using ONLY these exact tags for areas that show a real, `
    + `visible limitation (omit any tag with no visible issue): ${LIMITATION_TAGS.join(', ')}. `
    + 'If nothing stands out, write "LIMITATIONS: none".';

  return system;
}

function parseSection(raw, label) {
  const re = new RegExp(`^${label}:\\s*(.+)$`, 'im');
  const match = raw.match(re);
  return match ? { text: match[1].trim(), index: match.index } : null;
}

// photos: [{ poseKey, mediaType, data (base64) }]
// previousTest (optional): { assessment, flaggedLimitations } from the
// athlete's last mobility test, to get a genuine before/after comparison
// instead of just a standalone snapshot.
// Returns { unavailable: true } if no LLM is configured, otherwise
// { assessment, flaggedLimitations, progressNote, trend } (progressNote/
// trend are null when there's no previous test to compare against).
async function assessMobility(photos, previousTest = null) {
  if (!isAvailable()) return { unavailable: true, assessment: null, flaggedLimitations: [], progressNote: null, trend: null };

  const hasPrevious = !!(previousTest && previousTest.assessment);
  const system = buildSystem(hasPrevious);

  const poseLabels = photos.map((p) => fieldByKey(p.poseKey)?.label || p.poseKey).join(', ');
  let prompt = `These photos show an athlete's stretch test: ${poseLabels}.`;
  if (hasPrevious) {
    prompt += `\n\nTheir previous mobility assessment was: "${previousTest.assessment}"`
      + (previousTest.flaggedLimitations?.length
        ? ` (flagged limitations at the time: ${previousTest.flaggedLimitations.join(', ')})`
        : ' (no limitations flagged at the time)') + '.';
  }

  const images = photos.map((p) => ({ mediaType: p.mediaType, data: p.data }));
  const raw = await generateVisionText({ system, prompt, images, maxTokens: 600 });
  if (!raw) return { unavailable: false, assessment: null, flaggedLimitations: [], progressNote: null, trend: null };

  const limitationsSection = parseSection(raw, 'LIMITATIONS');
  let flaggedLimitations = [];
  if (limitationsSection) {
    const list = limitationsSection.text.toLowerCase();
    if (list !== 'none') {
      flaggedLimitations = list.split(',').map((s) => s.trim()).filter((t) => LIMITATION_TAGS.includes(t));
    }
  }

  let progressNote = null;
  let trend = null;
  let assessmentEnd = limitationsSection ? limitationsSection.index : raw.length;

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

  return { unavailable: false, assessment, flaggedLimitations, progressNote, trend };
}

module.exports = { assessMobility, MOBILITY_TEST_POSES, LIMITATION_TAGS, TREND_VALUES };
