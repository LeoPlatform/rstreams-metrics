import AWS from "aws-sdk";
import { AwsReporter } from "../aws-reporter";
import chai, { assert, expect } from "chai";
import sinon from "sinon";
import sinonchai from "sinon-chai";
chai.use(sinonchai);

describe("aws-reporter", () => {
	const sandbox = sinon.createSandbox();
	let putMetricData;
	beforeEach(() => {
		Object.keys(process.env).filter(key => key.startsWith("DD_")).forEach(key => delete process.env[key]);
		delete process.env.AWS_REGION;
		const s = getListenerStub();
		putMetricData = s.putMetricData;
	});

	afterEach(() => {
		sandbox.restore();
	});

	it("GetStaticReporter - null", () => {
		const reporter = AwsReporter.GetStaticReporter({});
		assert.isNull(reporter);
	});


	it("GetStaticReporter - config", () => {
		const reporter = AwsReporter.GetStaticReporter({
			AWS: {
				region: "mock-region"
			}
		});
		assert.isNotNull(reporter);
	});

	it("Constructor - env", () => {
		process.env.AWS_REGION = "mock-region";
		const reporter = new AwsReporter({});
		assert.isNotNull(reporter);
	});



	it("Constructor - default booleans", () => {
		const reporter = new AwsReporter();
		assert.isNotNull(reporter);
	});

	it("start", async function () {
		const reporter = new AwsReporter({});
		assert.isNotNull(reporter);
		await reporter.start();
		expect(putMetricData).to.not.be.called;
	});

	it("end", async function () {
		const reporter = new AwsReporter({});
		assert.isNotNull(reporter);
		await reporter.end();
		expect(putMetricData).to.not.be.called;
	});

	it("log", async function () {
		const reporter = new AwsReporter();
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
		await reporter.end();
		expect(putMetricData).to.be.called;

		assert.deepEqual(putMetricData.firstCall.firstArg,
			{
				"MetricData": [
					{
						"Dimensions": [
							{
								"Name": "tag1",
								"Value": "tv1",
							},
							{
								"Name": "tag2",
								"Value": "tv2",
							},
							{
								"Name": "tag2",
								"Value": "tv3",
							},
						],
						"MetricName": "metric-1",
						"Timestamp": undefined,
						"Unit": "Count",
						"Value": 1,
					},
					{
						"Dimensions": [],
						"MetricName": "metric-3",
						"Timestamp": undefined,
						"Unit": "Count",
						"Value": 3,
					},
					{
						"Dimensions": [
							{
								"Name": "tag3",
								"Value": "tv4",
							},
						],
						"MetricName": "metric-2",
						"Timestamp": date,
						"Unit": "Count",
						"Value": 2,
					},
				],
				"Namespace": "rstreams",
			});
	});


	it("log - don't send", async function () {
		const reporter = new AwsReporter({
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
		await reporter.end();
		expect(putMetricData).to.not.be.called;
	});

	it("log - over aws limit", async function () {
		const reporter = new AwsReporter();
		assert.isNotNull(reporter);

		const logsCount = 246;
		for (let i = 0; i < logsCount; i++) {
			reporter.log({
				id: "metric-id",
				value: i
			});
		}
		await reporter.end();
		expect(putMetricData).to.be.called;
		const putMetricDataCalls = Math.ceil(logsCount / AwsReporter.MetricsSendLimit);
		expect(putMetricData).to.be.callCount(putMetricDataCalls);

		for (let call = 0; call < putMetricDataCalls; call++) {
			assert.deepEqual(putMetricData.getCall(call).firstArg,
				{
					"MetricData": new Array(
						(call + 1 === putMetricDataCalls)
							? (logsCount % AwsReporter.MetricsSendLimit)
							: AwsReporter.MetricsSendLimit
					).fill(null).map((_, i) => ({
						"Dimensions": [],
						"MetricName": "metric-id",
						"Timestamp": undefined,
						"Unit": "Count",
						"Value": (call * AwsReporter.MetricsSendLimit) + i,
					})),
					"Namespace": "rstreams",
				});
		}
	});



	it("send - over aws limit", async function () {
		const reporter = new AwsReporter();
		assert.isNotNull(reporter);

		const logsCount = 246;
		const metrics = [];
		for (let i = 0; i < logsCount; i++) {
			metrics.push({
				id: "metric-id",
				value: i
			});
		}
		await reporter.send(metrics);
		expect(putMetricData).to.be.called;
		const putMetricDataCalls = Math.ceil(logsCount / AwsReporter.MetricsSendLimit);
		expect(putMetricData).to.be.callCount(putMetricDataCalls);

		for (let call = 0; call < putMetricDataCalls; call++) {
			assert.deepEqual(putMetricData.getCall(call).firstArg,
				{
					"MetricData": new Array(
						(call + 1 === putMetricDataCalls)
							? (logsCount % AwsReporter.MetricsSendLimit)
							: AwsReporter.MetricsSendLimit
					).fill(null).map((_, i) => ({
						"Dimensions": [],
						"MetricName": "metric-id",
						"Timestamp": undefined,
						"Unit": "Count",
						"Value": (call * AwsReporter.MetricsSendLimit) + i,
					})),
					"Namespace": "rstreams",
				});
		}
	});

	it("send - error", async function () {
		const reporter = new AwsReporter();
		assert.isNotNull(reporter);

		const metrics = [{
			id: "metric-id",
			value: 100
		}];
		putMetricData.callsFake((_data, cb) => cb(new Error("AWS Error happened")));
		try {
			await reporter.send(metrics);
			assert.fail("Should have thrown an error");
		} catch (err) {
			assert.equal(err.message, "AWS Error happened");
		}
		expect(putMetricData).to.be.called;
		expect(putMetricData).to.be.callCount(1);


	});


	function getListenerStub() {
		const putMetricData = sandbox.stub().callsFake((_data, cb) => cb());
		sandbox.stub(AWS, 'CloudWatch').returns({ putMetricData });

		return {
			putMetricData
		};
	}
});
