import type { ExploreNode } from '../data/exploreTypes';
import { computeAIActiveStateFromExplore } from './aiActiveStateFromExplore';
import { getExploreTaskResultsByNode } from './exploreTaskResults';

function getLatestTaskEvidence(nodeKey: string) {
  const results = getExploreTaskResultsByNode(nodeKey);
  return results[0] ?? null;
}

export function buildGptImagePromptForNode(node: ExploreNode) {
  const latestEvidence = getLatestTaskEvidence(node.key);
  const state = computeAIActiveStateFromExplore([]);

  return [
    'Generate an information-dense educational topology card for a mobile AI learning product.',
    '',
    `Node title: ${node.label}`,
    `Engine: ${node.engineKey}`,
    `Core question: ${node.coreQuestion}`,
    '',
    'Core idea:',
    node.summary,
    '',
    'Student intuition:',
    node.intuition,
    '',
    'Mechanism:',
    node.mechanism,
    '',
    node.formal ? `Formal frame: ${node.formal}` : '',
    '',
    `Related curriculum nodes: ${node.relatedCurriculumNodes.join(' / ')}`,
    `Related mistake patterns: ${node.relatedMistakePatterns.join(' / ')}`,
    '',
    'Latest student evidence:',
    latestEvidence
      ? `Answer: ${latestEvidence.userAnswer}\nReflection: ${latestEvidence.reflectionText}\nQuality score: ${Math.round(latestEvidence.qualityScore * 100)}%`
      : 'No student evidence yet. Use a general beginner-friendly explanation.',
    '',
    'AI Active state focus:',
    `World model: ${Math.round(state.worldModelClarity * 100)}%`,
    `Mind model: ${Math.round(state.mindModelStability * 100)}%`,
    `Meaning model: ${Math.round(state.meaningModelClarity * 100)}%`,
    `Action mechanism: ${Math.round(state.actionMechanismStrength * 100)}%`,
    `Dominant weakness: ${state.dominantWeakness}`,
    '',
    `Visual metaphor: ${node.mediaPromptSeed.visualMetaphor}`,
    `Style: ${node.mediaPromptSeed.gptImageStyle}`,
    '',
    'Visual requirements:',
    '- Central title node with crisp Chinese label.',
    '- 5 to 8 concept nodes arranged as a topology graph.',
    '- Use arrows to show cause, rule, feedback, or transformation relations.',
    '- Include one small curriculum bridge box.',
    '- Include one common mistake repair box.',
    '- Include one exploration task box.',
    '- High contrast, readable Chinese labels, luminous scientific atlas style.',
    '- Avoid real people, copyrighted characters, school logos, private information, and unreadable dense paragraphs.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildSeedancePromptForNode(node: ExploreNode) {
  const latestEvidence = getLatestTaskEvidence(node.key);
  const firstTask = node.explorationTasks[0];

  return [
    'Create a 9:16 educational manga-drama video for a foundation science exploration module.',
    '',
    `Engine: ${node.engineKey}`,
    `Node: ${node.label}`,
    `Core question: ${node.coreQuestion}`,
    '',
    'Core explanation:',
    node.summary,
    '',
    'Mechanism:',
    node.mechanism,
    '',
    'Student evidence:',
    latestEvidence
      ? `The student answer was: ${latestEvidence.userAnswer}\nThe student reflection was: ${latestEvidence.reflectionText}`
      : 'No student evidence yet. Make the video beginner-friendly.',
    '',
    'Storyboard:',
    ...(node.mediaPromptSeed.seedanceStoryboard.length > 0
      ? node.mediaPromptSeed.seedanceStoryboard.map((shot, index) => `${index + 1}. ${shot}`)
      : [
          '1. Global map: show where this node sits in the whole engine.',
          '2. Mechanism scene: animate the core mechanism with symbolic props.',
          '3. Curriculum bridge: connect the mechanism to a familiar textbook problem.',
          '4. Mistake repair: show how this concept fixes a common mistake.',
          '5. Exploration action: ask the student to complete one small task.',
        ]),
    '',
    firstTask
      ? `Exploration task: ${firstTask.taskTitle} - ${firstTask.taskDescription}`
      : 'Exploration task: ask the student to explain the core relation in one sentence.',
    '',
    'Constraints:',
    '- Every shot must teach, test, or connect the foundation concept.',
    '- Avoid generic scenery.',
    '- Use clear Chinese captions.',
    '- No real people, no copyrighted characters, no private student data.',
  ].join('\n');
}
