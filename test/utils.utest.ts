import { assert } from "chai";
import * as utils from "../utils";
import { GlobalPlus, metricEnvPrefix, ProcessPlus } from "../utils";

describe("utils", () => {
	beforeEach(() => {
		[
			"SOMEKEY",
			metricEnvPrefix + "SOMEKEY",
			"RSTREAMS_CONFIG",
			"AWS_LAMBDA_FUNCTION_NAME"
		].forEach(key => delete process.env[key]);
		delete (process as ProcessPlus).__config;

		delete (global as GlobalPlus).leosdk;
		utils.clearBusConfig();
	});

	it("getEvnValue", () => {
		assert.equal(utils.getEnvValue("SOMEKEY", "default"), "default");
		assert.equal(utils.getEnvValue(metricEnvPrefix + "SOMEKEY", "default"), "default");

		process.env.SOMEKEY = "value1";
		process.env[metricEnvPrefix + "SOMEKEY"] = "value2";
		assert.equal(utils.getEnvValue("SOMEKEY", "default"), "value1");
		delete process.env.SOMEKEY;
		assert.equal(utils.getEnvValue("SOMEKEY", "default"), "value2");
	});


	it("getDefaultMetricTags", () => {
		assert.deepEqual(utils.getDefaultMetricTags(), {
			bot: undefined,
			bus: null,
			environment: undefined,
			iid: "0",
			service: "rstreams",
			workflow: null
		});
	});

	it("getDefaultMetricTags - bot", () => {
		setEnv({
			AWS_LAMBDA_FUNCTION_NAME: "some-lambda-fn-name-test"
		});

		assert.deepEqual(utils.getDefaultMetricTags(), {
			bot: "some-lambda-fn-name-test",
			bus: null,
			environment: "test",
			iid: "0",
			service: "rstreams",
			workflow: "some-lambda-fn-name"
		});
	});

	it("getDefaultMetricTags - bus env", () => {
		setEnv({
			AWS_LAMBDA_FUNCTION_NAME: "some-lambda-prod-fn-name",
			RSTREAMS_CONFIG: JSON.stringify({ LeoCron: "SomeBusName-LeoCron-OtherStuff" })
		});

		assert.deepEqual(utils.getDefaultMetricTags(), {
			app: ["some-lambda"],
			bot: "some-lambda-prod-fn-name",
			bus: "SomeBusName",
			environment: "prod",
			iid: "0",
			service: "rstreams",
			workflow: "some-lambda"
		});
	});


	it("getDefaultMetricTags - bus global", () => {
		global.leosdk = {
			resources: { LeoCron: "SomeOtherBusName-LeoCron-OtherStuff" }
		};
		setEnv({
			AWS_LAMBDA_FUNCTION_NAME: "some-lambda-prod-fn-name",
		});

		assert.deepEqual(utils.getDefaultMetricTags(), {
			app: ["some-lambda"],
			bot: "some-lambda-prod-fn-name",
			bus: "SomeOtherBusName",
			environment: "prod",
			iid: "0",
			service: "rstreams",
			workflow: "some-lambda"
		});
	});

	it("getDefaultMetricTags - bus context sdk", () => {
		const config = setup();
		config.registry.context = {
			sdk: {
				configuration: {
					resources: { LeoCron: "SomeOtherOtherBusName-LeoCron-OtherStuff" }
				}
			}
		};
		setEnv({
			AWS_LAMBDA_FUNCTION_NAME: "some-lambda-prod-fn-name",
		});

		assert.deepEqual(utils.getDefaultMetricTags(), {
			app: ["some-lambda"],
			bot: "some-lambda-prod-fn-name",
			bus: "SomeOtherOtherBusName",
			environment: "prod",
			iid: "0",
			service: "rstreams",
			workflow: "some-lambda"
		});
	});


	it("getDefaultMetricTags - env bus", () => {
		const config = setup();
		config.registry.context = {
			sdk: {
				configuration: {
					resources: { LeoCron: "ProdBus-LeoCron-OtherStuff" }
				}
			}
		};

		assert.deepEqual(utils.getDefaultMetricTags(), {
			bot: undefined,
			bus: "ProdBus",
			environment: "Prod",
			iid: "0",
			service: "rstreams",
			workflow: null
		});
	});

	it("getDefaultMetricTags - bus cached", () => {
		const config = setup();
		config.registry.context = {
			sdk: {
				configuration: {
					resources: { LeoCron: "ProdBus-LeoCron-OtherStuff" }
				}
			}
		};

		assert.deepEqual(utils.getDefaultMetricTags(), {
			bot: undefined,
			bus: "ProdBus",
			environment: "Prod",
			iid: "0",
			service: "rstreams",
			workflow: null
		});
		assert.deepEqual(utils.getDefaultMetricTags(), {
			bot: undefined,
			bus: "ProdBus",
			environment: "Prod",
			iid: "0",
			service: "rstreams",
			workflow: null
		});
	});

	it("getDefaultMetricTags - env with bus without env", () => {
		const config = setup();
		config.registry.context = {
			sdk: {
				configuration: {
					resources: { LeoCron: "Bus-LeoCron-OtherStuff" }
				}
			}
		};

		assert.deepEqual(utils.getDefaultMetricTags(), {
			bot: undefined,
			bus: "Bus",
			environment: undefined,
			iid: "0",
			service: "rstreams",
			workflow: null
		});
	});

	it("getDefaultMetricTags - env with function name without env", () => {

		setEnv({
			AWS_LAMBDA_FUNCTION_NAME: "some-lambda-fn-name",
		});

		assert.deepEqual(utils.getDefaultMetricTags(), {
			bot: "some-lambda-fn-name",
			bus: null,
			environment: undefined,
			iid: "0",
			service: "rstreams",
			workflow: "some"
		});
	});

	it("getDefaultMetricTags - bot tags", () => {
		setup({
			tags: "some:tagValue,other:tag2,some:tagValue3"
		});

		assert.deepEqual(utils.getDefaultMetricTags(), {
			bot: undefined,
			bus: null,
			environment: undefined,
			iid: "0",
			service: "rstreams",
			workflow: null,
			other: ["tag2"],
			some: ["tagValue", "tagValue3"]
		});
	});

	it("getDefaultMetricTags - bot workflow", () => {
		setup({
			tags: "workflow:abc,tag2"
		});

		assert.deepEqual(utils.getDefaultMetricTags(), {
			bot: undefined,
			bus: null,
			environment: undefined,
			iid: "0",
			service: "rstreams",
			workflow: ["abc"],
		});
	});

	it("removeColon", () => {
		assert.equal(utils.removeColon("this:is:the:value"), "this_is_the_value");
		assert.equal(utils.removeColon("this:is_the:value"), "this_is_the_value");
		assert.equal(utils.removeColon("this:is-the:value"), "this_is-the_value");
		assert.equal(utils.removeColon("this+is+the+value"), "this+is+the+value");
		assert.equal(utils.removeColon("this*is*the*value"), "this*is*the*value");
	});

});

function setEnv(values: Record<string, unknown>) {
	Object.entries(values).forEach(([key, value]) => {
		if (value != null) {
			if (typeof value === "object") {
				value = JSON.stringify(value);
			}
			process.env[key] = value as string;
		}
	});
}

function setup(bot = undefined, event = undefined) {
	(process as ProcessPlus).__config = {
		registry: {
			id: bot?.id,
			__cron: bot,
			__event: event
		}
	};

	return (process as ProcessPlus).__config;
}
