import { clampThinkingLevel, streamOpenAIResponses } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const FAST_MODE_PROVIDER = "aab-gateway-fast";
export const FAST_MODE_API = "aab-openai-responses-fast";

export interface FastModeDependencies {
	clampThinkingLevel: typeof clampThinkingLevel;
	streamOpenAIResponses: typeof streamOpenAIResponses;
}

const defaultDependencies: FastModeDependencies = {
	clampThinkingLevel,
	streamOpenAIResponses,
};

/** Register AAB's fast-mode provider stream handler with Pi. */
export function registerFastModeProvider(
	pi: ExtensionAPI,
	dependencies: Partial<FastModeDependencies> = {},
): void {
	const {
		clampThinkingLevel: clamp,
		streamOpenAIResponses: stream,
	} = { ...defaultDependencies, ...dependencies };

	pi.registerProvider(FAST_MODE_PROVIDER, {
		api: FAST_MODE_API,
		streamSimple(model, context, options) {
			const responseModel = { ...model, api: "openai-responses" as const };
			const clampedReasoning = options?.reasoning
				? clamp(responseModel, options.reasoning)
				: undefined;
			const reasoningEffort = clampedReasoning === "off" ? undefined : clampedReasoning;

			return stream(responseModel, context, {
				...options,
				maxTokens: options?.maxTokens ?? model.maxTokens,
				reasoningEffort,
				serviceTier: "priority",
			});
		},
	});
}

export default function fastMode(pi: ExtensionAPI): void {
	registerFastModeProvider(pi);
}
