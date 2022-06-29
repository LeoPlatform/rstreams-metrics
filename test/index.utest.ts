
import { DynamicMetricReporter, MetricReporter } from "../index";
import chai, { assert, expect } from "chai";
import sinon from "sinon";
import sinonchai from "sinon-chai";
import { Metric } from "types";
chai.use(sinonchai);



describe("index", () => {
	const sandbox = sinon.createSandbox();

	class MockReporter implements MetricReporter {
		constructor() {
			this.start = sandbox.stub().callsFake(() => Promise<void>);
			this.logMock = this.log = sandbox.stub().callsFake(() => { /**/ });
			this.end = sandbox.stub().callsFake(() => Promise<void>);
		}
		logMock;

		start: () => Promise<void>;
		log: (metric: Metric) => void;
		end: () => Promise<void>;
	}

	beforeEach(() => {
		Object.keys(process.env).filter(key => key.startsWith("DD_")).forEach(key => delete process.env[key]);
		delete process.env.AWS_REGION;
	});

	afterEach(() => {
		sandbox.restore();
	});


	it("default", async () => {
		const reporter = new DynamicMetricReporter();
		await reporter.start();
		reporter.log({
			id: "metric-id",
			value: 1
		});
		await reporter.end();
	});

	it("array", async () => {
		const mockReporter = new MockReporter();
		const reporter = new DynamicMetricReporter([mockReporter]);
		await reporter.start();
		reporter.log({
			id: "metric-id",
			value: 1
		});
		await reporter.end();

		expect(mockReporter.start).to.be.called;
		expect(mockReporter.end).to.be.called;
		expect(mockReporter.log).to.be.called;

		assert.deepEqual(mockReporter.logMock.firstCall.firstArg, {
			"id": "metric-id",
			"tags": {
				"bot": undefined,
				"bus": null,
				"environment": undefined,
				"iid": "0",
				"service": "rstreams",
				"workflow": null,
			},
			"value": 1
		});
	});

	it("array - many", async () => {
		const mockReporter1 = new MockReporter();
		const mockReporter2 = new MockReporter();
		const reporter = new DynamicMetricReporter([mockReporter1, mockReporter2]);
		await reporter.start();
		reporter.log({
			id: "metric-id",
			value: 1
		});
		await reporter.end();

		expect(mockReporter1.start).to.be.called;
		expect(mockReporter1.end).to.be.called;
		expect(mockReporter1.log).to.be.called;

		assert.deepEqual(mockReporter1.logMock.firstCall.firstArg, {
			"id": "metric-id",
			"tags": {
				"bot": undefined,
				"bus": null,
				"environment": undefined,
				"iid": "0",
				"service": "rstreams",
				"workflow": null,
			},
			"value": 1
		});

		expect(mockReporter2.start).to.be.called;
		expect(mockReporter2.end).to.be.called;
		expect(mockReporter2.log).to.be.called;

		assert.deepEqual(mockReporter2.logMock.firstCall.firstArg, {
			"id": "metric-id",
			"tags": {
				"bot": undefined,
				"bus": null,
				"environment": undefined,
				"iid": "0",
				"service": "rstreams",
				"workflow": null,
			},
			"value": 1
		});
	});

	it("promise array", async () => {
		const mockReporter = new MockReporter();
		const reporter = new DynamicMetricReporter(Promise.resolve([mockReporter]));
		await reporter.start();
		reporter.log({
			id: "metric-id",
			value: 1
		});
		await reporter.end();

		expect(mockReporter.start).to.be.called;
		expect(mockReporter.end).to.be.called;
		expect(mockReporter.log).to.be.called;

		assert.deepEqual(mockReporter.logMock.firstCall.firstArg, {
			"id": "metric-id",
			"tags": {
				"bot": undefined,
				"bus": null,
				"environment": undefined,
				"iid": "0",
				"service": "rstreams",
				"workflow": null,
			},
			"value": 1
		});
	});
});
