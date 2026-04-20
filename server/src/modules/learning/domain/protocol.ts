export type MistakeCategory =
  | 'concept-confusion'
  | 'rule-recall'
  | 'strategy-selection'
  | 'careless-execution'
  | 'language-mapping';

export type KnowledgeActionType = 'select' | 'draw' | 'drag' | 'speak' | 'sequence';

export interface DiagnosedMistakePattern {
  id: string;
  category: MistakeCategory;
  label: string;
  description: string;
  evidence: string[];
  coachingHint: string;
}

export interface KnowledgeAction {
  id: string;
  label: string;
  actionType: KnowledgeActionType;
  instruction: string;
  successCriteria: string[];
  failureSignals: string[];
}

export interface ErrorRecord {
  painPoint: string;
  rule: string;
  questionText?: string;
  subject?: 'zh' | 'ma' | 'en';
  grade?: string;
  diagnosedMistakes: DiagnosedMistakePattern[];
  knowledgeAction: KnowledgeAction;
}
