An wrapper around sending metrics to AWS or DataDog

## Create a reporter

```typescript
import AWS from "aws-sdk";
import { DynamicMetricReporter } from "rstreams-metrics";

export const reporter: DynamicMetricReporter = new DynamicMetricReporter((async () => {
	let secret = await new AWS.SecretsManager({ region: process.env.AWS_REGION })
		.getSecretValue({ SecretId: "GlobalRSFMetricConfigs" })
		.promise();
	let config = JSON.parse(secret.SecretString);
	return config;
})());
```



## Using the reporter

```typescript
	await reporter.start();

	reporter.log({
		id: "my.custom.metric",
		value: Math.floor(Math.random() * 100),
		tags: {
			customTag1: "tag-value-1",
			customTag2: "tag-value-2"
		}
	});

	await reporter.end();
```

`start` needs to be called to initialze a grouping of metrics and `end` needs to be called to flush all stats

## Notes for the Cloud

When running in a lambda, `start` and `end` should be called at the start and end of the lambda handler.  Howerver, the reporter can be constructed outside the hander.
