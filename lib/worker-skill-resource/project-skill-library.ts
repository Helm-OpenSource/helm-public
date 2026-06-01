import type {
  HelmV21ProjectSkillEnvironmentSeam,
  HelmV21ProjectSkillEnvironmentSeamKind,
  HelmV21ProjectSkillLibraryCapabilitySignal,
  HelmV21ProjectSkillLibraryEntry,
  HelmV21ProjectSkillLibraryFlowRef,
  HelmV21ProjectSkillLibraryReadModel,
  HelmV21ProjectSkillLibraryResourceRef,
  HelmV21ProjectSkillLibraryWorkerRef,
} from "@/lib/helm-v2/contracts";
import {
  type RepresentativeWorkerSkillFlow,
  type ResourceBindingContract,
  type ResourceContract,
  type SkillContract,
  type WorkerContract,
  workerSkillResourceSprint2Blueprint,
} from "@/lib/worker-skill-resource/contract";

type CapabilitySignalInput = {
  id: string;
  name: string;
  stage: string;
  description: string;
  loadPolicy: string;
  reviewRequired: boolean;
  boundaryNote?: string | null;
};

type BuildProjectSkillLibraryReadModelInput = {
  capabilitySignals?: CapabilitySignalInput[];
};

const PROJECT_SKILL_LIBRARY_BOUNDARY_NOTE =
  "Project skill library stays project-scoped, review-first, and boundary-first. It catalogs worker / skill / resource contracts and environment seams without granting broader orchestration or execution authority.";

const ENVIRONMENT_SEAM_BLUEPRINTS = {
  workspace_context: {
    seamId: "workspace-context-seam",
    label: "Workspace context seam",
    boundaryNote:
      "Workspace context seams stay inside current-workspace evidence, replay, and review boundaries.",
  },
  connector: {
    seamId: "connector-seam",
    label: "Connector seam",
    boundaryNote:
      "Connector seams stay workspace-scoped and read-first here. They do not imply send, write-back, or broad connector platform authority.",
  },
  browser: {
    seamId: "browser-seam",
    label: "Browser seam",
    boundaryNote:
      "Browser seams stay bounded and replayable. They provide cited research support without widening execution authority.",
  },
  control_plane: {
    seamId: "control-plane-seam",
    label: "Control-plane seam",
    boundaryNote:
      "Control-plane seams keep internal review queues, risk signals, and governance surfaces explicit and auditable.",
  },
  official_action: {
    seamId: "official-action-seam",
    label: "Official action seam",
    boundaryNote:
      "Official action remains boundary-first and controlled. No worker / skill / resource binding in this slice gets autonomous official-action authority.",
  },
} satisfies Record<
  HelmV21ProjectSkillEnvironmentSeamKind,
  { seamId: string; label: string; boundaryNote: string }
>;

function uniqueSorted(items: Array<string | null | undefined>) {
  return Array.from(new Set(items.filter((item): item is string => Boolean(item)))).sort();
}

function classifyEnvironmentSeamKind(
  resource: ResourceContract,
): Exclude<HelmV21ProjectSkillEnvironmentSeamKind, "official_action"> {
  switch (resource.resourceType) {
    case "crm_connector":
      return "connector";
    case "browser_research":
      return "browser";
    case "review_queue":
    case "risk_signal":
      return "control_plane";
    default:
      return "workspace_context";
  }
}

function buildEnvironmentSeamSummary(
  seamKind: HelmV21ProjectSkillEnvironmentSeamKind,
  resourceCount: number,
  providers: string[],
) {
  if (seamKind === "official_action" && resourceCount === 0) {
    return "No project skill binding currently crosses into official-action execution. This seam stays boundary-only until a separate authority contract exists.";
  }

  const providerSummary = providers.length ? providers.join(", ") : "No provider bound yet";
  switch (seamKind) {
    case "workspace_context":
      return `Workspace-local context stays replayable and reviewable across ${resourceCount} bound resource${resourceCount === 1 ? "" : "s"} (${providerSummary}).`;
    case "connector":
      return `Connector-backed reads stay narrow and review-first across ${resourceCount} bound resource${resourceCount === 1 ? "" : "s"} (${providerSummary}).`;
    case "browser":
      return `Browser research stays bounded and cited across ${resourceCount} bound resource${resourceCount === 1 ? "" : "s"} (${providerSummary}).`;
    case "control_plane":
      return `Control-plane signals and queues stay explicit across ${resourceCount} bound resource${resourceCount === 1 ? "" : "s"} (${providerSummary}).`;
    case "official_action":
      return `Official action seam remains boundary-only (${providerSummary}).`;
  }
}

function buildSkillBoundaryNote(skill: SkillContract) {
  if (skill.customerFacingAllowed) {
    return skill.requiresApproval
      ? "Customer-facing output remains non-commitment-only, review-first, and approval-gated before anything external-safe is used."
      : "Customer-facing output remains non-commitment-only and review-before-send. This slice does not grant send authority.";
  }

  if (skill.effectMode === "internal_write") {
    return "This skill may prepare internal-only writes inside governed seams, but it does not widen external execution or commitment authority.";
  }

  return "This skill stays inside internal read/draft posture and remains reviewable, replayable, and non-committing.";
}

function buildWorkerRefs(skill: SkillContract, workers: WorkerContract[]): HelmV21ProjectSkillLibraryWorkerRef[] {
  return workers
    .flatMap((worker) => {
      const refs: HelmV21ProjectSkillLibraryWorkerRef[] = [];
      if (worker.defaultSkills.includes(skill.skillId)) {
        refs.push({
          workerId: worker.workerId,
          workerName: worker.workerName,
          workerRole: worker.workerRole,
          assignmentMode: "default",
          reviewMode: worker.reviewMode,
          outputMode: worker.outputMode,
        });
      }
      if (worker.optionalSkills.includes(skill.skillId)) {
        refs.push({
          workerId: worker.workerId,
          workerName: worker.workerName,
          workerRole: worker.workerRole,
          assignmentMode: "optional",
          reviewMode: worker.reviewMode,
          outputMode: worker.outputMode,
        });
      }
      return refs;
    })
    .sort((left, right) =>
      left.assignmentMode === right.assignmentMode
        ? left.workerName.localeCompare(right.workerName)
        : left.assignmentMode === "default"
          ? -1
          : 1,
    );
}

function buildFlowRefs(
  skill: SkillContract,
  flows: RepresentativeWorkerSkillFlow[],
): HelmV21ProjectSkillLibraryFlowRef[] {
  return flows
    .filter((flow) => flow.skillId === skill.skillId)
    .map((flow) => ({
      flowId: flow.flowId,
      scenarioType: flow.scenarioType,
      outputMode: flow.outputMode,
      controlPlaneChecks: [...flow.controlPlaneChecks],
    }));
}

function buildResourceRefs(
  skill: SkillContract,
  bindingsById: Map<string, ResourceBindingContract>,
  resourcesById: Map<string, ResourceContract>,
): HelmV21ProjectSkillLibraryResourceRef[] {
  return skill.resourceBindings
    .map((bindingId) => {
      const binding = bindingsById.get(bindingId);
      if (!binding) {
        throw new Error(`Skill ${skill.skillId} is missing binding ${bindingId}`);
      }
      const resource = resourcesById.get(binding.resourceId);
      if (!resource) {
        throw new Error(`Binding ${bindingId} is missing resource ${binding.resourceId}`);
      }
      const seamKind = classifyEnvironmentSeamKind(resource);
      return {
        bindingId: binding.bindingId,
        resourceId: resource.resourceId,
        resourceName: resource.resourceName,
        resourceType: resource.resourceType,
        resourceSummary: resource.resourceSummary,
        provider: resource.provider,
        resourceCapability: binding.resourceCapability,
        authMode: binding.authMode,
        invocationMode: binding.invocationMode,
        effectMode: binding.effectMode,
        fallback: skill.fallbackBindings.includes(binding.bindingId),
        seamId: ENVIRONMENT_SEAM_BLUEPRINTS[seamKind].seamId,
        seamKind,
      };
    })
    .sort((left, right) => left.resourceName.localeCompare(right.resourceName));
}

function buildLiveCapabilitySignals(
  capabilitySignals: CapabilitySignalInput[],
): HelmV21ProjectSkillLibraryCapabilitySignal[] {
  return capabilitySignals
    .map((item) => ({
      id: item.id,
      name: item.name,
      stage: item.stage,
      description: item.description,
      loadPolicy: item.loadPolicy,
      reviewRequired: item.reviewRequired,
      boundaryNote: item.boundaryNote ?? PROJECT_SKILL_LIBRARY_BOUNDARY_NOTE,
    }))
    .sort((left, right) =>
      left.stage === right.stage ? left.name.localeCompare(right.name) : left.stage.localeCompare(right.stage),
    );
}

export function buildProjectSkillLibraryReadModel(
  input: BuildProjectSkillLibraryReadModelInput = {},
): HelmV21ProjectSkillLibraryReadModel {
  const bundle = workerSkillResourceSprint2Blueprint;
  const workers = bundle.workers;
  const skills = bundle.skills;
  const flows = bundle.representativeFlows;
  const resources = bundle.resources;
  const bindings = bundle.resourceBindings;
  const resourcesById = new Map(resources.map((resource) => [resource.resourceId, resource]));
  const bindingsById = new Map(bindings.map((binding) => [binding.bindingId, binding]));
  const liveCapabilitySignals = buildLiveCapabilitySignals(input.capabilitySignals ?? []);

  const seamAccumulator = new Map<
    HelmV21ProjectSkillEnvironmentSeamKind,
    {
      resourceIds: string[];
      resourceTypes: string[];
      providers: string[];
      authModes: string[];
      invocationModes: string[];
      effectModes: string[];
    }
  >();

  for (const binding of bindings) {
    const resource = resourcesById.get(binding.resourceId);
    if (!resource) continue;
    const seamKind = classifyEnvironmentSeamKind(resource);
    const current = seamAccumulator.get(seamKind) ?? {
      resourceIds: [],
      resourceTypes: [],
      providers: [],
      authModes: [],
      invocationModes: [],
      effectModes: [],
    };
    current.resourceIds.push(resource.resourceId);
    current.resourceTypes.push(resource.resourceType);
    current.providers.push(resource.provider);
    current.authModes.push(binding.authMode);
    current.invocationModes.push(binding.invocationMode);
    current.effectModes.push(binding.effectMode);
    seamAccumulator.set(seamKind, current);
  }

  const environmentSeams: HelmV21ProjectSkillEnvironmentSeam[] = (
    Object.keys(ENVIRONMENT_SEAM_BLUEPRINTS) as HelmV21ProjectSkillEnvironmentSeamKind[]
  ).map((seamKind) => {
    const blueprint = ENVIRONMENT_SEAM_BLUEPRINTS[seamKind];
    const aggregate = seamAccumulator.get(seamKind);
    const resourceIds = uniqueSorted(aggregate?.resourceIds ?? []);
    const resourceTypes = uniqueSorted(aggregate?.resourceTypes ?? []);
    const providers = uniqueSorted(aggregate?.providers ?? []);
    const authModes = uniqueSorted(aggregate?.authModes ?? []);
    const invocationModes = uniqueSorted(aggregate?.invocationModes ?? []);
    const effectModes = uniqueSorted(aggregate?.effectModes ?? []);
    return {
      seamId: blueprint.seamId,
      seamKind,
      state: resourceIds.length > 0 ? "active" : "planned_boundary_only",
      label: blueprint.label,
      summary: buildEnvironmentSeamSummary(seamKind, resourceIds.length, providers),
      boundaryNote: blueprint.boundaryNote,
      resourceIds,
      resourceTypes,
      providers,
      authModes,
      invocationModes,
      effectModes,
    };
  });

  const skillEntries: HelmV21ProjectSkillLibraryEntry[] = skills.map((skill) => {
    const workerRefs = buildWorkerRefs(skill, workers);
    const flowRefs = buildFlowRefs(skill, flows);
    const resourceRefs = buildResourceRefs(skill, bindingsById, resourcesById);
    const environmentSeamIds = uniqueSorted(resourceRefs.map((item) => item.seamId));
    const environmentSummary = environmentSeamIds
      .map((seamId) => environmentSeams.find((item) => item.seamId === seamId)?.label ?? seamId)
      .join(" + ");

    return {
      skillId: skill.skillId,
      skillName: skill.skillName,
      skillType: skill.skillType,
      riskLevel: skill.riskLevel,
      effectMode: skill.effectMode,
      requiresReview: skill.requiresReview,
      requiresApproval: skill.requiresApproval,
      customerFacingAllowed: skill.customerFacingAllowed,
      nonCommitmentOnly: skill.nonCommitmentOnly,
      workerRefs,
      flowRefs,
      resourceRefs,
      environmentSeamIds,
      environmentSummary,
      boundaryNote: buildSkillBoundaryNote(skill),
    };
  });

  return {
    contractBundle: "worker_skill_resource_sprint_2",
    boundaryNote: PROJECT_SKILL_LIBRARY_BOUNDARY_NOTE,
    summary: {
      workerCount: workers.length,
      skillCount: skills.length,
      resourceCount: resources.length,
      flowCount: flows.length,
      activeEnvironmentSeams: environmentSeams.filter((item) => item.state === "active").length,
      boundaryOnlyEnvironmentSeams: environmentSeams.filter(
        (item) => item.state === "planned_boundary_only",
      ).length,
      customerFacingSkills: skillEntries.filter((item) => item.customerFacingAllowed).length,
      approvalRequiredSkills: skillEntries.filter((item) => item.requiresApproval).length,
      liveCapabilitySignals: liveCapabilitySignals.length,
    },
    environmentSeams,
    skillEntries,
    liveCapabilitySignals,
  };
}
