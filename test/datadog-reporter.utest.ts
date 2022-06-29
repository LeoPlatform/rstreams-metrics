
const DatadogMetrics = require("datadog-lambda-js/dist/metrics/listener");
import { DataDogReporter } from "../datadog-reporter";
import chai, { assert, expect } from "chai";
import sinon from "sinon";
import sinonchai from "sinon-chai";
chai.use(sinonchai);

describe("datadog-reporter", () => {
	const sandbox = sinon.createSandbox();
	beforeEach(() => {
		Object.keys(process.env).filter(key => key.startsWith("DD_")).forEach(key => delete process.env[key]);
	});

	afterEach(() => {
		sandbox.restore();
	});

	it("GetStaticReporter - null", () => {
		const reporter = DataDogReporter.GetStaticReporter({});
		assert.isNull(reporter);
	});


	it("GetStaticReporter - config", () => {
		const reporter = DataDogReporter.GetStaticReporter({
			DataDog: {
				apiKey: "mock-api-key"
			}
		});
		assert.isNotNull(reporter);
	});

	it("GetStaticReporter - env", () => {
		process.env.DD_API_KEY = "mock-api-key";
		const reporter = DataDogReporter.GetStaticReporter({});
		assert.isNotNull(reporter);
	});

	it("Constructor - default moving", () => {
		const reporter = new DataDogReporter({
			key: "mock-api-key",
			site: "mock-site",
		});
		assert.isNotNull(reporter);
	});


	it("Constructor - default booleans", () => {
		process.env.DD_DONT_SEND = "";
		process.env.DD_FLUSH_TO_LOG = "";
		process.env.DD_ENHANCED_METRICS = "";
		const reporter = new DataDogReporter({});
		assert.isNotNull(reporter);
	});

	it("start", async function () {

		const {
			start,
			end,
			log,
			logDate
		} = getListenerStub();

		const reporter = new DataDogReporter({
			key: "mock-api-key",
			site: "mock-site",
		});
		assert.isNotNull(reporter);
		await reporter.start();
		expect(start).to.be.called;
		expect(end).to.not.be.called;
		expect(log).to.not.be.called;
		expect(logDate).to.not.be.called;
	});

	it("end", async function () {
		const {
			start,
			end,
			log,
			logDate
		} = getListenerStub();

		const reporter = new DataDogReporter({
			key: "mock-api-key",
			site: "mock-site",
		});
		assert.isNotNull(reporter);
		await reporter.end();
		expect(start).to.not.be.called;
		expect(end).to.be.called;
		expect(log).to.not.be.called;
		expect(logDate).to.not.be.called;
	});

	it("log", async function () {
		const {
			start,
			end,
			log,
			logDate
		} = getListenerStub();

		const reporter = new DataDogReporter({
			key: "mock-api-key",
			site: "mock-site",
		});
		assert.isNotNull(reporter);
		reporter.log({
			id: "metric-1",
			value: 1,
			tags: {
				tag1: "tv1",
				tag2: ["tv2", "tv3"]
			}
		});

		reporter.log({
			id: "metric-3",
			value: 3
		});

		const date = new Date(1234567890);
		reporter.log({
			id: "metric-2",
			value: 2,
			tags: {
				tag3: "tv4"
			},
			timestamp: date
		});
		expect(start).to.not.be.called;
		expect(end).to.not.be.called;
		expect(log).to.be.called;
		expect(logDate).to.be.called;

		assert.deepEqual(log.firstCall.args, [
			"metric-1",
			1,
			false,
			"tag1:tv1",
			"tag2:tv2",
			"tag2:tv3",
		]);
		assert.deepEqual(log.secondCall.args, [
			"metric-3",
			3,
			false
		]);
		assert.deepEqual(logDate.firstCall.args, [
			"metric-2",
			2,
			date,
			false,
			"tag3:tv4",
		]);
	});


	it("log - don't send", async function () {
		const {
			start,
			end,
			log,
			logDate
		} = getListenerStub();

		const reporter = new DataDogReporter({
			key: "mock-api-key",
			site: "mock-site",
			dontSendMetrics: true
		});
		assert.isNotNull(reporter);
		reporter.log({
			id: "metric-1",
			value: 1,
			tags: {
				tag1: "tv1",
				tag2: ["tv2", "tv3"]
			}
		});

		reporter.log({
			id: "metric-3",
			value: 3
		});

		const date = new Date(1234567890);
		reporter.log({
			id: "metric-2",
			value: 2,
			tags: {
				tag3: "tv4"
			},
			timestamp: date
		});
		expect(start).to.not.be.called;
		expect(end).to.not.be.called;
		expect(log).to.not.be.called;
		expect(logDate).to.not.be.called;
	});
	function getListenerStub() {
		const onStartInvocation = sandbox.stub().callsFake(() => Promise<void>);
		const onCompleteInvocation = sandbox.stub().callsFake(() => Promise<void>);
		const sendDistributionMetric = sandbox.stub().callsFake(() => Promise<void>);
		const sendDistributionMetricWithDate = sandbox.stub().callsFake(() => Promise<void>);
		sandbox.stub(DatadogMetrics, "MetricsListener").callsFake(() => {
			return {
				onStartInvocation,
				onCompleteInvocation,
				sendDistributionMetric,
				sendDistributionMetricWithDate
			};
		});

		return {
			start: onStartInvocation,
			end: onCompleteInvocation,
			log: sendDistributionMetric,
			logDate: sendDistributionMetricWithDate
		};
	}
});
