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

function fieldByKey(key) {
  return MOBILITY_TEST_POSES.find((p) => p.key === key);
}

// photos: [{ poseKey, mediaType, data (base64) }]
// Returns { unavailable: true } if no LLM is configured, otherwise
// { assessment, flaggedLimitations } (assessment may be null if the call failed).
async function assessMobility(photos) {
  if (!isAvailable()) return { unavailable: true, assessment: null, flaggedLimitations: [] };

  const system = 'You are a movement coach assessing an athlete\'s mobility from photos of stretch positions. '
    + 'For each photo, note visible range of motion, form, and any asymmetry or limitation, in plain direct '
    + 'language a coach could act on immediately. This is a visual impression, not a clinical measurement -- '
    + 'do not state exact degrees or numbers you can\'t actually see. '
    + `End your response with a line starting exactly "LIMITATIONS:" followed by a comma-separated list using `
    + `ONLY these exact tags for areas that show a real, visible limitation (omit any tag with no visible issue): `
    + `${LIMITATION_TAGS.join(', ')}. If nothing stands out, write "LIMITATIONS: none".`;

  const poseLabels = photos.map((p) => fieldByKey(p.poseKey)?.label || p.poseKey).join(', ');
  const prompt = `These photos show an athlete's stretch test: ${poseLabels}. Give a short, direct mobility `
    + 'assessment (3-5 sentences) a coach could act on, then the LIMITATIONS line.';

  const images = photos.map((p) => ({ mediaType: p.mediaType, data: p.data }));
  const raw = await generateVisionText({ system, prompt, images, maxTokens: 500 });
  if (!raw) return { unavailable: false, assessment: null, flaggedLimitations: [] };

  const match = raw.match(/LIMITATIONS:\s*(.+)$/im);
  let flaggedLimitations = [];
  if (match) {
    const list = match[1].trim().toLowerCase();
    if (list !== 'none') {
      flaggedLimitations = list.split(',').map((s) => s.trim()).filter((t) => LIMITATION_TAGS.includes(t));
    }
  }
  const assessment = match ? raw.slice(0, match.index).trim() : raw;

  return { unavailable: false, assessment, flaggedLimitations };
}

module.exports = { assessMobility, MOBILITY_TEST_POSES, LIMITATION_TAGS };
