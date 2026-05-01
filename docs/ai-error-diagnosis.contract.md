# AI Error Diagnosis Contract

Version: `ai-error-diagnosis-v0.1`

## Scope

P3-5A defines the contract for future AI-assisted error diagnosis. It only adds TypeScript types, fixture builders, runtime validators, and this document.

This contract does not:

- call a real AI provider
- register a backend route
- change the current error-book flow
- trigger media generation
- change Explore or Yufeng state

## Future Endpoint

The intended future endpoint is:

```text
POST /api/errors/diagnosis
```

P3-5A does not implement this route. Later phases should add a mock client first, then a state machine, then a real provider adapter.

## Request

```json
{
  "schemaVersion": "ai-error-diagnosis-v0.1",
  "errorInput": {
    "questionText": "阅读材料后回答：为什么主人公最后改变了决定？",
    "ocrText": "",
    "studentAnswer": "因为他一开始想错了。",
    "correctAnswer": "他理解了同伴的真实意图，并重新判断了情境。",
    "explanationText": "答案需要结合上下文中的人物动机和情境变化。",
    "subject": "zh",
    "grade": "七年级"
  },
  "learningProfile": {
    "worldModelIndex": 0.4,
    "mindModelIndex": 0.4,
    "meaningModelIndex": 0.4,
    "actionMechanismIndex": 0.25,
    "activeStructuralIntelligence": 0.45,
    "dominantStrength": "world",
    "dominantWeakness": "game",
    "stage": "forming",
    "profileSummary": "学习者已经开始形成基础结构，但证据还不稳定。",
    "recommendedNextFocus": "建议优先补强反馈回路。",
    "recommendedNodeKey": "game.feedback_loop"
  },
  "clientMeta": {
    "appVersion": "local-dev",
    "source": "web",
    "requestedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

At least one of `questionText`, `ocrText`, `studentAnswer`, or `explanationText` must be non-empty. `learningProfile` is optional but should be included when available so later diagnosis can align with the current Yufeng cockpit state.

## Success Response

```json
{
  "ok": true,
  "diagnosedAt": "2026-01-01T00:00:00.000Z",
  "result": {
    "mistakeKey": "context_misread",
    "confidence": 0.78,
    "summary": "学生没有把答案放回上下文和人物动机中判断，导致解释停留在表层。",
    "fourLayerExplanation": {
      "curriculum": "这类题需要回到材料，找出人物、情境和关键转折。",
      "worldEngine": "题目中的事件不是孤立发生的，人物行为受到情境约束。",
      "mindEngine": "学生可能只抓住了表面动作，没有推断人物想法的变化。",
      "meaningEngine": "真正要解释的是“为什么改变”，不是复述“发生了什么”。",
      "gameMechanism": "先定位关键信号，再用反馈回路检查答案是否解释了题目目标。"
    },
    "recommendedExploreNodes": {
      "primaryNodeKey": "language.context",
      "secondaryNodeKeys": [
        "neuroscience.cognition_consciousness",
        "game.feedback_loop"
      ]
    },
    "repairAction": "重做时先圈出人物、时间、场景、目的，再写一句“改变的原因”。",
    "yufengSuggestion": "完成语境判断节点后，保存一次御风快照，观察意义模型是否提升。"
  },
  "message": "Fixture diagnosis success."
}
```

## Mistake Keys

The v0.1 contract supports these diagnosis keys:

```text
context_misread
rule_mismatch
meaning_misunderstanding
conservation_missing
attention_distracted
repeated_same_mistake
feedback_loop_broken
unknown
```

## Failure Response

```json
{
  "ok": false,
  "diagnosedAt": "2026-01-01T00:00:00.000Z",
  "message": "Fixture diagnosis failure.",
  "errors": [
    {
      "code": "MISSING_ERROR_CONTENT",
      "message": "Provide questionText or ocrText before diagnosis.",
      "path": "errorInput"
    }
  ]
}
```

## Validation Rules

- `schemaVersion` must be `ai-error-diagnosis-v0.1`.
- `clientMeta` is required.
- `errorInput.subject` must be one of the supported subject keys.
- At least one error content field must be non-empty.
- `mistakeKey` must be one of the v0.1 mistake keys.
- `confidence` must be between `0` and `1`.
- All four-layer explanation fields must be non-empty.
- `recommendedExploreNodes.primaryNodeKey` is required.
- `recommendedExploreNodes.secondaryNodeKeys` must be an array.
- `repairAction` and `yufengSuggestion` are required.

## Integration Order

Recommended next phases:

```text
P3-5B mock client
P3-5C diagnosis state machine
P3-5D UI read-only preview
P3-5E backend mock API route
P3-5F HTTP mock client switch
P3-5G real provider adapter behind feature flag
```

Real provider adapters must remain outside this contract layer.

## P3-5B Mock Client

`src/features/errors/diagnosis/mockAiDiagnosisClient.ts` provides a local-only mock implementation of the v0.1 contract. It validates requests with `validateAIErrorDiagnosisRequest`, returns contract-shaped failures for invalid input, and infers a deterministic `mistakeKey` from local keywords.

The mock client does not call the network, does not register a backend route, and does not change the current error-book flow. Use `getDefaultAIErrorDiagnosisClient()` when later debug-only surfaces need a callable diagnosis service.

## P3-5E Mock API Route

`POST /api/errors/diagnosis` is now available as a server-side mock route for the HTTP contract path. It returns:

```ts
{
  ok: true,
  diagnosis,
  diagnosedAt
}
```

Invalid requests return `400` with:

```ts
{
  ok: false,
  diagnosis: null,
  errors,
  diagnosedAt
}
```

This route currently uses deterministic local mock rules only. It does not call a real AI provider, does not change the current error-book flow, and does not write to Yufeng task state.

## P3-5F HTTP Client

`src/features/errors/diagnosis/httpAiDiagnosisClient.ts` adds a front-end HTTP client for `POST /api/errors/diagnosis`. It validates the local request before making a network call, posts the v0.1 diagnosis request, and normalizes the server mock route's `diagnosis` field into the front-end diagnosis response `result` field.

`AIDiagnosisDebugWorkbench` can now switch between:

```text
Local Mock Client
HTTP /api/errors/diagnosis
```

The default remains local mock. The HTTP endpoint can be configured with:

```text
VITE_AI_DIAGNOSIS_CLIENT=mock
VITE_AI_DIAGNOSIS_CLIENT=http
VITE_AI_DIAGNOSIS_ENDPOINT=/api/errors/diagnosis
```

This client still targets the mock API route only. It does not call a real AI provider, does not change the current error-book flow, and does not write to Yufeng task state.

## P3-5G Provider Adapter Contract

`POST /api/errors/diagnosis` now resolves diagnosis through the server-side `DiagnosisProvider` contract. The current default provider is:

```text
mockDiagnosisProvider
```

The route response includes `provider: "mock"` so clients can verify which adapter produced the diagnosis. Future real AI providers must implement the same `DiagnosisProvider` interface before being wired into the factory.

This phase still does not call a real AI API, does not change the current error-book flow, and does not write to Yufeng task state.

## P3-5H Prompt Template Contract

`server/src/diagnosis/prompt/buildDiagnosisPrompt.ts` defines the prompt bundle future real AI diagnosis providers must use before calling a model. The bundle contains:

- `systemPrompt`
- `developerPrompt`
- `userPrompt`
- `outputSchema`
- `privacyNotes`
- `costGuard`

Future real AI providers must:

1. Use the `DiagnosisProvider` interface.
2. Use `buildDiagnosisPrompt` to construct the prompt.
3. Require JSON-only output.
4. Validate parsed output with `validateParsedDiagnosisModelOutput`.
5. Avoid supervision, ranking, surveillance, and external reporting language.
6. Redact email-like strings and 11-digit phone numbers before model input.
7. Respect `costGuard.maxInputChars`, `costGuard.maxOutputTokens`, and `costGuard.requireJsonOnly`.

This phase only defines the prompt contract, fixtures, and validators. It does not call a real AI API, does not change the current error-book flow, and does not write to Yufeng task state.

## P3-5I Real AI Provider Stub

`server/src/diagnosis/realAiDiagnosisProviderStub.ts` reserves the implementation slot for a future real AI diagnosis provider. It is disabled by default and does not call any external model.

P3-5I supported these provider modes:

```text
DIAGNOSIS_PROVIDER=mock
DIAGNOSIS_PROVIDER=real-ai-stub
```

Default behavior remains `mock`. P3-5I initially returned `provider: "real-ai-stub"` with `REAL_AI_PROVIDER_NOT_CONFIGURED`; P3-5J replaces that path with safety-gate errors or `REAL_AI_PROVIDER_STUB_ONLY`.

Future real AI providers must:

1. Use `buildDiagnosisPrompt`.
2. Call a real model only after the safety gate is implemented.
3. Parse JSON-only output.
4. Validate output with `validateParsedDiagnosisModelOutput`.
5. Fall back to mock or return structured errors on failure.
6. Avoid injecting private information into prompts.
7. Respect `costGuard`.

This phase does not read real API keys, does not call OpenAI/Gemini/any external model, does not change the current error-book flow, and does not write to Yufeng task state.

## P3-5J Real AI Provider Safety Gate

`server/src/diagnosis/realAiProviderSafetyGate.ts` defines the safety gate that every future real AI diagnosis provider must pass before any external model call is allowed. The current `realAiDiagnosisProviderStub` calls this gate, but it still always returns `ok: false` and never calls an external model.

The gate requires:

1. `ALLOW_REAL_AI_DIAGNOSIS=true`.
2. API key presence is configured, without reading or passing the key value to a model client.
3. Prompt output must be JSON only.
4. Prompt input must not exceed `costGuard.maxInputChars`.
5. Output tokens must stay within the diagnosis cost threshold.
6. Input must already have privacy redaction applied.
7. Output must later pass `validateParsedDiagnosisModelOutput`.
8. Failures must return structured errors.
9. External model calls must not bypass the `DiagnosisProvider` interface.

Recognized environment switches for this phase:

```text
DIAGNOSIS_PROVIDER=mock | real-ai-stub
ALLOW_REAL_AI_DIAGNOSIS=false | true
REAL_AI_DIAGNOSIS_API_KEY=placeholder
```

Defaults remain:

```text
DIAGNOSIS_PROVIDER=mock
ALLOW_REAL_AI_DIAGNOSIS=false
```

When `DIAGNOSIS_PROVIDER=real-ai-stub` and the safety gate fails, the route returns the safety gate's structured errors. When the safety gate passes, the route still returns `REAL_AI_PROVIDER_STUB_ONLY` because P3-5J does not connect OpenAI, Gemini, or any other external model.

## P3-5K Real AI Provider Dry Run Adapter

`server/src/diagnosis/realAiDiagnosisDryRunProvider.ts` simulates the future real AI provider's internal data flow without calling any external model. It is enabled only when explicitly selected:

```text
DIAGNOSIS_PROVIDER=real-ai-dry-run
```

When `DIAGNOSIS_PROVIDER=real-ai-dry-run`, the provider:

1. Does not call OpenAI, Gemini, `fetch`, or any external SDK.
2. Constructs the real prompt bundle with `buildDiagnosisPrompt`.
3. Runs `validateRealAiProviderSafety`.
4. Uses `diagnosisPromptOutputFixture` as the simulated model JSON output.
5. Runs `validateParsedDiagnosisModelOutput`.
6. Returns a standard `DiagnosisProviderResult`.
7. Lets the route verify the future real AI provider flow end to end.

The dry-run provider still requires the same explicit gate inputs as the real provider path:

```text
ALLOW_REAL_AI_DIAGNOSIS=true
REAL_AI_DIAGNOSIS_API_KEY=placeholder
```

If the safety gate fails, it returns structured gate errors. If the gate and fixture validation pass, it returns `ok: true`, `provider: "real-ai-dry-run"`, and the fixture diagnosis. Default provider behavior remains `mock`.
