import { CloudWatch, MetricDatum, StandardUnit } from "@aws-sdk/client-cloudwatch";
import leoLogger from "leo-logger";
import { Metric, MetricReporter, ReporterConfigs } from './types';
import async from 'async';
import { removeColon } from "./utils";

const logger = leoLogger("aws-reporter");

export interface AWSConfig {
	region?: string;
	dontSendMetrics?: boolean;
}

export class AwsReporter implements MetricReporter {

	static GetStaticReporter(configs: ReporterConfigs): AwsReporter | null {
		const awsConfig = configs.AWS;

		if (awsConfig) {
			awsConfig.dontSendMetrics = configs.dontSendMetrics;
			return new AwsReporter(awsConfig);
		}
		return null;
	}

	public name = "AWS";

	static MetricsSendLimit = 20;

	private cloudwatch: CloudWatch;

	metrics = [];
	metricPromises = [];
	sendMetrics: boolean;

	constructor(config?: Partial<AWSConfig>) {
		this.cloudwatch = new CloudWatch({
			region: config?.region || process.env.AWS_REGION || "us-east-1"
		});
		this.sendMetrics = config?.dontSendMetrics !== true;
	}
	async start() {
		// Nothing to do
	}

	log(metric: Metric) {
		this.metrics.push(metric);
		if (this.metrics.length >= AwsReporter.MetricsSendLimit) {
			this.metricPromises.push(this.send(this.metrics.splice(0, AwsReporter.MetricsSendLimit)));
		}
	}
	async end() {
		this.metricPromises.push(this.send(this.metrics.splice(0, this.metrics.length)));
		await Promise.all(this.metricPromises.splice(0, this.metricPromises.length));
	}

	async send(metrics: Metric[]) {
		// Split into chunks of 20.  AWS only allows 20 metrics per
		const awsMetrics: MetricDatum[][] = metrics.reduce((chunks, metric) => {
			let currentChunk = chunks[chunks.length - 1];
			if (currentChunk.length == AwsReporter.MetricsSendLimit) {
				currentChunk = [];
				chunks.push(currentChunk);
			}
			const metricId = metric.id;

			// Map object tags to a string array
			// colons seperate the key:value in the tags
			const tags = Object.entries(metric.tags || {})
				.filter(([key, value]) => value != null && key != "service")
				.map(([key, value]) => {
					const cleanKey = removeColon(key);
					if (Array.isArray(value)) {
						return value.map(value => ({
							Name: cleanKey,
							Value: removeColon(value)
						}));
					} else {
						return [{
							Name: cleanKey,
							Value: removeColon(value)
						}];
					}

				}).reduce((all, one) => all.concat(one), []);

			logger.debug(metricId, metric.value, ...tags);
			const units = metric.units || "Count";
			currentChunk.push({
				MetricName: metricId,
				Value: metric.value,
				Unit: units[0].toUpperCase() + units.substring(1) as StandardUnit,
				Dimensions: tags,
				Timestamp: metric.timestamp
			});

			return chunks;
		}, [[]] as MetricDatum[][]).filter(a => a.length);

		// Send it all to AWS
		if (this.sendMetrics) {
			await new Promise((resolve, reject) => {
				async.eachOfLimit(awsMetrics, 10, (value: MetricDatum[], _key: string, cb) => {
					this.cloudwatch.putMetricData({
						Namespace: "rstreams",
						MetricData: value
					}, (err) => cb(err));
				}, (err, data) => err ? reject(err) : resolve(data));
			});
		}
	}
}

