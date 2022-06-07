import { DataDogReporter } from "./datadog-reporter";
import leoLogger from "leo-logger";
import { Metric, MetricReporter, ReporterConfigs } from "./types";
import { getDefaultMetricTags } from "./utils";
export * from "./utils";
const logger = leoLogger("rstreams-metrics");

export class DynamicMetricReporter implements MetricReporter {
	static ReporterChecker: ((configs: ReporterConfigs) => MetricReporter | null)[] = [
		DataDogReporter.GetStaticReporter
	];

	private reporters: MetricReporter[];
	private setupPromise: Promise<MetricReporter[] | ReporterConfigs>;

	constructor(reporters?: MetricReporter[] | ReporterConfigs | Promise<MetricReporter[] | ReporterConfigs>) {

		if (reporters != null && reporters instanceof Promise) {
			this.setupPromise = reporters as unknown as Promise<MetricReporter[] | ReporterConfigs>;
		} else {
			this.setupPromise = Promise.resolve(reporters);
		}

		this.setupPromise.then((reporters: MetricReporter[] | ReporterConfigs) => {
			if (reporters != null && Array.isArray(reporters)) {
				this.reporters = reporters;
			} else {
				this.reporters = DynamicMetricReporter.ReporterChecker.map(constructor => constructor(reporters as ReporterConfigs)).filter(r => r != null);
			}
		});

	}

	async start() {
		await this.setupPromise;
		await Promise.all(this.reporters.map(reporter => reporter.start()));
	}
	log(metric: Metric) {

		metric.tags = {
			...getDefaultMetricTags(),
			...metric.tags
		};


		this.reporters.forEach(reporter => {
			reporter.log(metric);
		});
	}
	async end() {
		await Promise.all(this.reporters.map(reporter => reporter.end()));
	}
}
