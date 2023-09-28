import AWS from "aws-sdk";
import { AwsReporter } from "./aws-reporter";
import { DataDogReporter } from "./datadog-reporter";
import { Metric, MetricReporter, ReporterConfigs } from "./types";
import { getDefaultMetricTags } from "./utils";
export * from "./utils";
export * from "./types";

export class DynamicMetricReporter implements MetricReporter {
	static ReporterChecker: ((configs: ReporterConfigs) => MetricReporter | null)[] = [
		DataDogReporter.GetStaticReporter,
		AwsReporter.GetStaticReporter
	];

	private reporters: MetricReporter[];
	private setupPromise: Promise<MetricReporter[] | ReporterConfigs>;

	constructor(reporters?: MetricReporter[] | ReporterConfigs | Promise<MetricReporter[] | ReporterConfigs>) {

		if (reporters != null && reporters instanceof Promise) {
			this.setupPromise = reporters as unknown as Promise<MetricReporter[] | ReporterConfigs>;
		} else if (reporters != null) {
			this.setupPromise = Promise.resolve(reporters);
		} else {
			this.setupPromise = (async () => {
				const secret = await new AWS.SecretsManager({ region: process.env.AWS_REGION })
					.getSecretValue({ SecretId: 'GlobalRSFMetricConfigs' })
					.promise();
				return JSON.parse(secret.SecretString);
			})().catch(e => {
				console.log("Error getting default secret 'GlobalRSFMetricConfigs'", e);
				return null;
			});
		}

		this.setupPromise.then((reporters: MetricReporter[] | ReporterConfigs) => {
			if (reporters != null && Array.isArray(reporters)) {
				this.reporters = reporters;
			} else {
				this.reporters = DynamicMetricReporter.ReporterChecker.map(constructor => constructor((reporters || {}) as ReporterConfigs)).filter(r => r != null);
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
