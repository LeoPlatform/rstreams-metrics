import { DataDogConfig } from "./datadog-reporter";

export interface Metric {
	id: string,
	value: number,
	timestamp?: Date,
	tags: Record<string, string>
}

export interface MetricReporter {
	start: () => Promise<void>;
	log: (metric: Metric) => void;
	end: () => Promise<void>;
}

export interface ReporterConfigs {
	DataDog?: Partial<DataDogConfig>,
	dontSendMetrics?: boolean,
}
