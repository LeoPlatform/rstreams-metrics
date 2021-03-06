export interface ProcessPlus {
	__config?: {
		registry?: {
			id?: string;
			context?: {
				sdk?: {
					configuration: unknown;
					LeoCron?: string;
					resources?: {
						LeoCron: string;
					};
				}
			},
			__cron?: Record<string, unknown>,
			__event?: Record<string, unknown>,
		}
	}
}

export interface GlobalPlus {
	leosdk?: {
		resources: { LeoCron: string }
	}
}

interface Bot {
	iid: string;
	id: string,
	lambdaName?: string,
	tags?: string
}

export const metricEnvPrefix = "RSTREAMS_METRICS_";

export function removeColon(value: string): string {
	return value.replace(/:/g, "_");
}

export function getEnvValue(key: string, defaultValue: string): string {
	const val = process.env[key];
	const val2 = process.env[metricEnvPrefix + key];
	return val !== undefined ? val : (val2 != undefined ? val2 : defaultValue);
}

function determineBotWorkflow(bot: Bot, environment: string): string | undefined {

	// Get the workflow: tag from the bot
	const workflowTag = ((bot.tags || "").split(",").find(t => t.match(/^workflow:/)) || "").split(":")[1];
	if (workflowTag) {
		return workflowTag;
	}


	const id = (bot.id || "").toLowerCase();
	const lambdaName = (bot.lambdaName || "").toLowerCase();

	// Regex for finding bot workflow from id or lambdaName
	const startsWithNameAndStage = new RegExp(`^([A-z_-]+?)[./\\-_\\b]*${environment}`, "i");
	const startsWithStage = new RegExp(`^${environment}[./\\-_\\b]*([A-z_-]+)`, "i");
	const endsWithStage = new RegExp(`([A-z_-]+?)[./\\-_\\b]*${environment}$`, "i");

	// Try to parse the bot id and lambda name
	const element = [id, lambdaName].map(id =>
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
function getBotTags(bot: Bot): Record<string, string[]> {
	// Get all tags that follow the pattern key:value
	const botTags: Record<string, string[]> = (bot.tags || "").split(",").reduce((tags, t) => {
		const [, key, value] = t.match(/^(.*?):(.*)$/) || [];
		if (key && value) {
			if (!tags[key]) {
				tags[key] = [];
			}
			tags[key].push(value);
		}
		return tags;
	}, {} as Record<string, string[]>);

	if (!botTags.app && process.env.AWS_LAMBDA_FUNCTION_NAME) {
		const app = process.env.AWS_LAMBDA_FUNCTION_NAME.split(/^(.*?)-(?:dev|test|staging|stage|production|prod)-/i);
		if (app && app.length > 1 && app[1]) {
			botTags.app = [app[1]];
		}
	}


	return botTags;
}

const EnvRegex = /(dev|test|staging|stage|production|prod)/i;
const nodeEnvName = "NODE_ENV"; // Some bundlers will rewrite this to a hard coded value.  We only want it when it is specifically set.
function getEnvironment(bus?: string): string {
	// From env

	let env = process.env.LEO_ENVIRONMENT || process.env[nodeEnvName];

	if (!env && process.env.AWS_LAMBDA_FUNCTION_NAME) {
		env = (process.env.AWS_LAMBDA_FUNCTION_NAME.match(EnvRegex) || [])[1];
	}

	if (!env && bus) {
		env = (bus.match(EnvRegex) || [])[1];
	}


	return env;
}

let busConfig: {
	bus?: string
};
function getBus(): string | null {
	if (busConfig === undefined) {
		busConfig = {
			bus: null
		};

		const rstreamsEnv = [
			process.env.RSTREAMS_CONFIG,
			process.env.leosdk,
			process.env.leo_sdk,
			process.env["leo-sdk"],
			process.env.LEOSDK,
			process.env.LEO_SDK,
			process.env["LEO-SDK"],
		].find(e => e);

		let rstreamsConfig: {
			LeoCron?: string;
			resources?: {
				LeoCron: string
			}
		};

		if (rstreamsEnv) {
			try {
				rstreamsConfig = JSON.parse(rstreamsEnv);
			} catch (e) {
				// skip
			}
		}
		// From  rstreams config
		if (!rstreamsConfig && (global as GlobalPlus).leosdk) {
			rstreamsConfig = (global as GlobalPlus).leosdk;
		}

		// Pull from context sdk
		const p = process as ProcessPlus;
		if (!rstreamsConfig && p.__config?.registry?.context?.sdk?.configuration) {
			rstreamsConfig = p.__config.registry.context.sdk.configuration;
		}

		if (rstreamsConfig && (rstreamsConfig.LeoCron || (rstreamsConfig.resources && rstreamsConfig.resources.LeoCron))) {
			busConfig.bus = (rstreamsConfig.LeoCron || rstreamsConfig.resources.LeoCron).split("-LeoCron-")[0];
		}
	}

	return busConfig.bus;
}

export function clearBusConfig() {
	busConfig = undefined;
}

function getBot(): Bot {
	const registry = (process as ProcessPlus).__config?.registry || {};
	const bot = {
		id: registry.id || process.env.AWS_LAMBDA_FUNCTION_NAME,
		iid: "0",
		...registry.__event,
		...registry.__cron,
		lambdaName: process.env.AWS_LAMBDA_FUNCTION_NAME
	};
	return bot;
}

export function getDefaultMetricTags(): Record<string, string | string[]> {

	const bot = getBot();

	const botId = bot.id;
	const botTags = getBotTags(bot);
	const bus = getBus();
	const environment = getEnvironment(bus);
	const workflow = determineBotWorkflow(bot, environment);
	return {
		workflow: workflow ? workflow.toLowerCase() : null,
		...botTags,
		bot: botId,
		environment: environment,
		bus: bus,
		iid: bot.iid,
		service: "rstreams",
	};
}
