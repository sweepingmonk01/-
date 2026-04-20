export interface AnalyzeQuestionImageInput {
  imageBase64: string;
  mimeType: string;
}

export interface AIQuestionData {
  painPoint: string;
  rule: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
}

export interface GenerateCloneQuestionInput {
  painPoint: string;
  rule: string;
  questionText: string;
}

export interface GenerateTheaterScriptInput {
  painPoint: string;
  rule: string;
}

export interface TheaterScript {
  sceneIntro: string;
  emotion: string;
  interactionPrompt: string;
  successScene: string;
  failureScene: string;
}

export interface DehydrateHomeworkInput {
  imageBase64: string;
  mimeType: string;
  targetScore: number;
}

export interface DehydrateResult {
  total: number;
  trashEasy: number;
  dropHard: number;
  mustDo: number;
  reasoning: string;
  mustDoIndices: string;
}
