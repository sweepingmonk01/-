import type { KnowledgeActionType, SocraticThread, StrategyDecision } from '../../lib/mobius';

export type TheaterMode = 'idle' | 'generating' | 'playing' | 'interaction' | 'resolution';

export interface TheaterMeta {
  source: 'mobius' | 'deepseek';
  provider?: string;
  videoStatus?: 'queued' | 'processing' | 'ready' | 'failed';
  videoUrl?: string;
  activeVideoUrl?: string;
  mediaJobId?: string;
  providerJobId?: string;
  errorMessage?: string;
  coachMessage?: string;
  lastMediaSyncAt?: string;
  nextActions?: string[];
  resolutionTitle?: string;
  branchOutcome?: 'success' | 'failure';
  contentKnowledgePointTitle?: string;
  contentKnowledgePointGrade?: string;
  contentEvidence?: string[];
  foundationNodeKey?: string;
  foundationNodeLabel?: string;
  foundationNodeReason?: string;
  relatedQuestionSummary?: string[];
  diagnosedMistakeLabels?: string[];
  knowledgeActionLabel?: string;
  knowledgeActionType?: KnowledgeActionType;
  knowledgeActionId?: string;
  strategyDecision?: StrategyDecision;
  adjudicationRationale?: string[];
  diagnosticThread?: SocraticThread;
}
