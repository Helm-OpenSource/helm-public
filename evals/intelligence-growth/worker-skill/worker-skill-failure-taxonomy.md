# Worker/Skill Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| zero_artifact_quality | Artifact quality score is zero | Escalate to `rejected`; worker produced no usable output | Auto-retry worker invocation |
| high_invocation_failure_count | skillInvocationFailureCount ≥ 5 | Escalate to `review_required`; systematic failure pattern needs human diagnosis | Auto-disable skill silently |
| excessive_boundary_hits | boundaryHitCount ≥ 10 | Escalate to `rejected`; repeated boundary violations indicate scope breach | Auto-widen the boundary for this worker |
| moderate_boundary_hits | boundaryHitCount 3–9 | Downgrade to `watch_only`; boundary contact pattern needs monitoring | Treat boundary hits as successful outcomes |
| skill_suggestion_auto_promoted | Any indication that a SkillSuggestionCandidate was auto-promoted | Escalate to `rejected`; auto-promotion is not permitted | Allow SkillSuggestion auto-promotion |
| worker_ref_workspace_mismatch | workerRef workspace ID does not match eval workspace ID | Escalate to `rejected`; cross-workspace worker reference violates isolation | Auto-remap worker workspace |
| artifact_quality_inversion | Quality score decreases across successive eval runs for same worker | Downgrade to `review_required`; regression pattern needs human review | Silently accept the regression |
| boundary_hit_with_low_quality | boundaryHitCount > 0 and artifactQualityScore < 0.50 | Escalate to `review_required`; combination of boundary hit and low quality is high risk | Treat separately as independent issues |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：Worker / Skill 质量评估结果不走自动晋升路径
- SkillSuggestionCandidate 不自动晋升：必须经人工批准
- no-auto-promote：worker artifact 质量 eval 只作为 learning candidate
