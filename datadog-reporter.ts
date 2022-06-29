import { Metric, MetricReporter, ReporterConfigs } from "./types";
import leoLogger from "leo-logger";
import { KMSService, MetricsConfig, MetricsListener } from 'datadog-lambda-js/dist/metrics';
import { getEnvValue, removeColon } from "./utils";

const logger = leoLogger("rstreams-metrics").sub("datadog-reporter");

export interface DataDogConfig extends MetricsConfig {
	key?: string;
	site?: string;
	dontSendMetrics?: boolean;
}

export class DataDogReporter implements MetricReporter {

	static GetStaticReporter(configs: ReporterConfigs): DataDogReporter | null {
		const ddConfig = configs.DataDog || {};
		ddConfig.dontSendMetrics = configs.dontSendMetrics;
		if (ddConfig.apiKey || ddConfig.key || getEnvValue(DataDogReporter.apiKeyEnvVar, "") || getEnvValue(DataDogReporter.apiKeyKMSEnvVar, "")) {
			return new DataDogReporter(ddConfig);
		}
		return null;
	}

	static apiKeyEnvVar = "DD_API_KEY";
	static apiKeyKMSEnvVar = "DD_KMS_API_KEY";
	static captureLambdaPayloadEnvVar = "DD_CAPTURE_LAMBDA_PAYLOAD";
	static traceManagedServicesEnvVar = "DD_TRACE_MANAGED_SERVICES";
	static siteURLEnvVar = "DD_SITE";
	static logLevelEnvVar = "DD_LOG_LEVEL";
	static logForwardingEnvVar = "DD_FLUSH_TO_LOG";
	static logInjectionEnvVar = "DD_LOGS_INJECTION";
	static enhancedMetricsEnvVar = "DD_ENHANCED_METRICS";
	static datadogHandlerEnvVar = "DD_LAMBDA_HANDLER";
	static lambdaTaskRootEnvVar = "LAMBDA_TASK_ROOT";
	static mergeXrayTracesEnvVar = "DD_MERGE_XRAY_TRACES";
	static traceExtractorEnvVar = "DD_TRACE_EXTRACTOR";
	static defaultSiteURL = "datadoghq.com";

	static dontSendEnvVar = "DD_DONT_SEND";

	public name = "DataDog";
	kmsService: KMSService;
	metricsListener: MetricsListener;
	sendMetrics: boolean;

	constructor(config?: Partial<DataDogConfig>) {

		const dontSendMetrics = (config && config.dontSendMetrics === true) || (getEnvValue(DataDogReporter.dontSendEnvVar, "false") || "false") === "true";

		//this.sendMetrics = (config && config.dontSendMetrics !== true) || (getEnvValue(DataDogReporter.dontSendEnvVar, "false") || "false") !== "true"
		this.sendMetrics = !dontSendMetrics;
		this.kmsService = new KMSService();

		if (config.site && !config.siteURL) {
			config.siteURL = config.site;
		}
		if (config.key && !config.apiKey) {
			config.apiKey = config.key;
		}

		this.metricsListener = new MetricsListener(this.kmsService, {
			apiKey: getEnvValue(DataDogReporter.apiKeyEnvVar, ""),
			apiKeyKMS: getEnvValue(DataDogReporter.apiKeyKMSEnvVar, ""),
			siteURL: getEnvValue(DataDogReporter.siteURLEnvVar, DataDogReporter.defaultSiteURL),
			shouldRetryMetrics: false,
			logForwarding: (getEnvValue(DataDogReporter.logForwardingEnvVar, "false") || "false") === "true",
			enhancedMetrics: (getEnvValue(DataDogReporter.enhancedMetricsEnvVar, "false") || "false") === "true",
			...config
		});
	}

	async start() {
		await this.metricsListener.onStartInvocation({});
	}
	async end() {
		await this.metricsListener.onCompleteInvocation();
	}

	log(metric: Metric) {
		const metricId = metric.id;

		// Map object tags to a string array
		// colons seperate the key:value in the tags
		const tags = Object.entries(metric.tags || {})
			.filter(([_key, value]) => value != null)
			.map(([key, value]) => {
				const cleanKey = removeColon(key);
				if (Array.isArray(value)) {
					return value.map(value => `${cleanKey}:${removeColon(value)}`);
				} else {
					return [`${cleanKey}:${removeColon(value)}`];
				}
			}).reduce((all, one) => all.concat(one), []);

		// Send it all to DataDog
		logger.debug(metricId, metric.value, ...tags);
		if (this.sendMetrics) {
			if (metric.timestamp != null) {
				this.metricsListener.sendDistributionMetricWithDate(metricId, metric.value, metric.timestamp, false, ...tags);
			} else {
				this.metricsListener.sendDistributionMetric(metricId, metric.value, false, ...tags);
			}
		}
	}
}


