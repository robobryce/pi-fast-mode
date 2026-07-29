import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import type { ExtensionAPI, ProviderConfig } from "@earendil-works/pi-coding-agent";
import fastMode, {
	FAST_MODE_API,
	FAST_MODE_PROVIDER,
	registerFastModeProvider,
	type FastModeDependencies,
} from "../src/index.ts";

type StreamSimple = NonNullable<ProviderConfig["streamSimple"]>;
type Model = Parameters<StreamSimple>[0];
type Context = Parameters<StreamSimple>[1];
type StreamOptions = Parameters<StreamSimple>[2];
type StreamResult = ReturnType<StreamSimple>;

interface Registration {
	name: string;
	config: ProviderConfig;
}

function model(overrides: Partial<Model> = {}): Model {
	return {
		id: "openai/gpt-5.6-sol",
		name: "GPT-5.6 Sol Fast",
		api: FAST_MODE_API,
		provider: FAST_MODE_PROVIDER,
		baseUrl: "https://gateway.example.com/v1",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 16_384,
		...overrides,
	};
}

function context(): Context {
	return { messages: [] };
}

function captureRegistration(
	register: (pi: ExtensionAPI) => void,
): Registration {
	let registration: Registration | undefined;
	const pi = {
		registerProvider(name: string, config: ProviderConfig): void {
			registration = { name, config };
		},
	};
	register(pi as ExtensionAPI);
	assert.ok(registration, "fast-mode provider was not registered");
	return registration;
}

function streamSimple(registration: Registration): StreamSimple {
	assert.ok(registration.config.streamSimple, "provider has no stream handler");
	return registration.config.streamSimple;
}

test("registers the AAB fast provider and custom API", () => {
	const registration = captureRegistration(fastMode);

	assert.equal(registration.name, FAST_MODE_PROVIDER);
	assert.equal(registration.config.api, FAST_MODE_API);
});

test("delegates the response model, context, options, and return stream", () => {
	const sentinel = { stream: "sentinel" } as unknown as StreamResult;
	const calls: Parameters<FastModeDependencies["streamOpenAIResponses"]>[] = [];
	const delegate: FastModeDependencies["streamOpenAIResponses"] = (...args) => {
		calls.push(args);
		return sentinel;
	};
	const registration = captureRegistration((pi) => {
		registerFastModeProvider(pi, { streamOpenAIResponses: delegate });
	});
	const sourceModel = model();
	const sourceContext = context();
	const options: StreamOptions = {
		apiKey: "test-key",
		headers: { "x-test": "value" },
		maxTokens: 4096,
		reasoning: "high",
	};

	const result = streamSimple(registration)(sourceModel, sourceContext, options);

	assert.equal(result, sentinel);
	assert.equal(calls.length, 1);
	const [delegatedModel, delegatedContext, delegatedOptions] = calls[0];
	assert.notEqual(delegatedModel, sourceModel);
	assert.deepEqual(delegatedModel, { ...sourceModel, api: "openai-responses" });
	assert.equal(delegatedContext, sourceContext);
	assert.equal(delegatedOptions?.apiKey, "test-key");
	assert.deepEqual(delegatedOptions?.headers, { "x-test": "value" });
	assert.equal(delegatedOptions?.maxTokens, 4096);
});

test("calls Pi helpers as bare functions without binding this", () => {
	const clampReceivers: unknown[] = [];
	const streamReceivers: unknown[] = [];
	const clamp = function (this: unknown) {
		clampReceivers.push(this);
		return "high";
	} as FastModeDependencies["clampThinkingLevel"];
	const delegate = function (this: unknown) {
		streamReceivers.push(this);
		return {} as StreamResult;
	} as FastModeDependencies["streamOpenAIResponses"];
	const registration = captureRegistration((pi) => {
		registerFastModeProvider(pi, {
			clampThinkingLevel: clamp,
			streamOpenAIResponses: delegate,
		});
	});

	streamSimple(registration)(model(), context(), { reasoning: "high" });

	assert.deepEqual(clampReceivers, [undefined]);
	assert.deepEqual(streamReceivers, [undefined]);
});

test("always forces priority service tier and falls back to the model token limit", () => {
	const calls: Parameters<FastModeDependencies["streamOpenAIResponses"]>[] = [];
	const delegate: FastModeDependencies["streamOpenAIResponses"] = (...args) => {
		calls.push(args);
		return {} as StreamResult;
	};
	const registration = captureRegistration((pi) => {
		registerFastModeProvider(pi, { streamOpenAIResponses: delegate });
	});
	const options = { serviceTier: "flex" } as StreamOptions;

	streamSimple(registration)(model({ maxTokens: 8192 }), context(), options);

	assert.equal(calls.length, 1);
	assert.equal(calls[0][2]?.serviceTier, "priority");
	assert.equal(calls[0][2]?.maxTokens, 8192);
});

test("clamps requested thinking and maps off to no reasoning effort", () => {
	type Clamp = FastModeDependencies["clampThinkingLevel"];
	const clampCalls: Parameters<Clamp>[] = [];
	const clamp: Clamp = (...args) => {
		clampCalls.push(args);
		return "off";
	};
	const streamCalls: Parameters<FastModeDependencies["streamOpenAIResponses"]>[] = [];
	const delegate: FastModeDependencies["streamOpenAIResponses"] = (...args) => {
		streamCalls.push(args);
		return {} as StreamResult;
	};
	const registration = captureRegistration((pi) => {
		registerFastModeProvider(pi, {
			clampThinkingLevel: clamp,
			streamOpenAIResponses: delegate,
		});
	});

	streamSimple(registration)(model(), context(), { reasoning: "xhigh" });

	assert.equal(clampCalls.length, 1);
	assert.equal(clampCalls[0][0].api, "openai-responses");
	assert.equal(clampCalls[0][1], "xhigh");
	assert.equal(streamCalls[0][2]?.reasoningEffort, undefined);
});

test("passes a supported thinking level through as reasoning effort", () => {
	type Clamp = FastModeDependencies["clampThinkingLevel"];
	const clamp: Clamp = () => "high";
	const calls: Parameters<FastModeDependencies["streamOpenAIResponses"]>[] = [];
	const delegate: FastModeDependencies["streamOpenAIResponses"] = (...args) => {
		calls.push(args);
		return {} as StreamResult;
	};
	const registration = captureRegistration((pi) => {
		registerFastModeProvider(pi, {
			clampThinkingLevel: clamp,
			streamOpenAIResponses: delegate,
		});
	});

	streamSimple(registration)(model(), context(), { reasoning: "high" });

	assert.equal(calls[0][2]?.reasoningEffort, "high");
});

test("preserves model thinking mappings for the OpenAI Responses streamer", () => {
	const calls: Parameters<FastModeDependencies["streamOpenAIResponses"]>[] = [];
	const delegate: FastModeDependencies["streamOpenAIResponses"] = (...args) => {
		calls.push(args);
		return {} as StreamResult;
	};
	const registration = captureRegistration((pi) => {
		registerFastModeProvider(pi, { streamOpenAIResponses: delegate });
	});
	const thinkingLevelMap = { xhigh: "high" } as Model["thinkingLevelMap"];

	streamSimple(registration)(model({ thinkingLevelMap }), context(), { reasoning: "xhigh" });

	assert.equal(calls[0][2]?.reasoningEffort, "xhigh");
	assert.equal(calls[0][0].thinkingLevelMap, thinkingLevelMap);
});

test("does not clamp when no thinking level was requested", () => {
	let clampCalls = 0;
	const clamp: FastModeDependencies["clampThinkingLevel"] = () => {
		clampCalls += 1;
		return "high";
	};
	const calls: Parameters<FastModeDependencies["streamOpenAIResponses"]>[] = [];
	const delegate: FastModeDependencies["streamOpenAIResponses"] = (...args) => {
		calls.push(args);
		return {} as StreamResult;
	};
	const registration = captureRegistration((pi) => {
		registerFastModeProvider(pi, {
			clampThinkingLevel: clamp,
			streamOpenAIResponses: delegate,
		});
	});

	streamSimple(registration)(model(), context());

	assert.equal(clampCalls, 0);
	assert.equal(calls[0][2]?.reasoningEffort, undefined);
});

test("package metadata points Pi at the shipped extension", () => {
	const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	assert.deepEqual(manifest.pi.extensions, ["./src/index.ts"]);
	assert.ok(manifest.files.includes("src"));
	assert.equal(manifest.dependencies, undefined);
});
