
export const metricEnvPrefix = "RSTREAMS_METRICS_";

export function removeColon(value: string): string {
	return value.replace(/:/g, "_");
}

export function getEnvValue(key: string, defaultValue: string): string {
	const val = process.env[key];
	const val2 = process.env[metricEnvPrefix + key];
	return val !== undefined ? val : (val2 != undefined ? val2 : defaultValue);
}

function determineBotWorkflow(bot: {
	tags?: string,
	lambdaName?: string,
	id?: string
}, environment: string): string | undefined {

	// Get the workflow: tag from the bot
	let workflowTag = ((bot.tags || "").split(",").find(t => t.match(/^workflow:/)) || "").split(":")[1]
	if (workflowTag) {
		return workflowTag;
	}


	let id = (bot.id || "").toLowerCase();
	let lambdaName = (bot.lambdaName || "").toLowerCase();

	// Search for any known matching groups

	let fallbackGroup = undefined;

	if (fallbackGroup) {
		if (fallbackGroup.id_regex) {
			return (id.match(fallbackGroup.id_regex) || [])[1] || fallbackGroup.id
		}
		return fallbackGroup.id;
	}

	// Regex for finding bot workflow from id or lambdaName
	const startsWithNameAndStage = new RegExp(`^([A-z]+?)[./\\-_\\b]*${environment}`, "i");
	const startsWithStage = new RegExp(`^${environment}[./\\-_\\b]*([A-z]+)`, "i");
	const endsWithStage = new RegExp(`([A-z]+?)[./\\-_\\b]*${environment}$`, "i");

	// Try to parse the bot id and lambda name
	let element = [id, lambdaName].map(id =>
		(id.match(startsWithNameAndStage) || [])[1] ||
		(id.match(startsWithStage) || [])[1] ||
		(id.match(endsWithStage) || [])[1])
		.find(a => a);
	if (element) {
		return element;
	}



	// use the first matching part of the bot id
	return ((bot.id || "").match(/^(.+?)(?:[./\-_\b]|$)/) || [])[1] || bot.id;

}
/**
 * @param bot 
 * @returns the value of the bot tag `app`
 */
function getBotTags(bot: { tags?: string }): Record<string, string> {
	// Get all tags that follow the pattern key:value
	let workflowTag = (bot.tags || "").split(",").reduce((tags, t) => {
		let [_, key, value] = t.match(/^(.*?):(.*)$/) || [];
		if (key && value) {
			tags[key] = value;
		}
		return tags;
	}, {});
	return workflowTag;
}
function getEnvironment(): string {
	// From env
	let env = process.env.LEO_ENVIRONMENT || process.env.NODE_ENV;

	let rstreamsEnv = [
		process.env.RSTREAMS_CONFIG,
		process.env.leosdk,
		process.env.leo_sdk,
		process.env["leo-sdk"],
		process.env.LEOSDK,
		process.env.LEO_SDK,
		process.env["LEO-SDK"],
	].find(e => e);
	// From  rstreams config


	return env;
}

let busConfig;
function getBus(): string {
	if (busConfig === undefined) {
		busConfig = {
			bus: ""
		};

		let config: {
			name?: string;
			registry?: {
				id?: string,
				context?: any,
				__cron?: {
					id: string;
				},
			}
		} = (process as any).__config || {}

		// rstreams-sdk
		// try env vars

	}

	return busConfig.bus
}

export function getDefaultMetricTags(): Record<string, string> {
	let botId = "";
	let bot = {};
	let botTags = getBotTags(bot);
	let bus = getBus();
	let environment = getEnvironment();
	let workflow = determineBotWorkflow(bot, environment);
	return {
		workflow: workflow ? workflow.toLowerCase() : null,
		...botTags,
		bot: botId,
		environment: environment,
		bus: bus,
		service: "rstreams",
	}
}
