import type {
	Api,
	AssistantMessageEventStream,
	Context,
	Model,
	SimpleStreamOptions,
} from "@earendil-works/pi-ai";

export interface ProviderConfig {
	api?: Api;
	streamSimple?: (
		model: Model<Api>,
		context: Context,
		options?: SimpleStreamOptions,
	) => AssistantMessageEventStream;
}

export interface ExtensionAPI {
	registerProvider(name: string, config: ProviderConfig): void;
}
