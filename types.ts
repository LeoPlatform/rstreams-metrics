import { AWSConfig } from "./aws-reporter";
import { DataDogConfig } from "./datadog-reporter";

export interface Metric {
	id: string,
	value: number,
	timestamp?: Date,
	tags?: Record<string, string | string[]>,
	units?: string,
}

export interface MetricReporter {
	start: () => Promise<void>;
	log: (metric: Metric) => void;
	end: () => Promise<void>;
}

export interface ReporterConfigs {
	AWS?: Partial<AWSConfig>,
	DataDog?: Partial<DataDogConfig>,
	dontSendMetrics?: boolean,
}
