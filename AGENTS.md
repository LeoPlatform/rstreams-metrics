# rstreams-metrics - AI-Assisted Development Guide

## Overview

**rstreams-metrics** is a metrics reporting library for RStreams/Leo. It provides a pluggable reporter interface for sending metrics to AWS CloudWatch or DataDog, commonly used in Leo microservices and Lambda handlers.

- **Primary branch**: main
- **Language**: TypeScript (compiled to JS)
- **Main entry**: index.ts

---

## Repository Structure

- index.ts - DynamicMetricReporter, main export
- types.ts - Metric, MetricReporter, ReporterConfigs interfaces
- aws-reporter.ts - AWS CloudWatch reporter
- datadog-reporter.ts - DataDog reporter
- utils.ts - Shared utilities (getDefaultMetricTags, removeColon)
- test/ - Mocha unit tests (*.utest.ts)

---

## Key Concepts

### DynamicMetricReporter
- Accepts reporters array, ReporterConfigs, or Promise (e.g. SecretsManager)
- ReporterChecker: DataDogReporter.GetStaticReporter, AwsReporter.GetStaticReporter
- start() / log(metric) / end() lifecycle

### Metric Interface
- id, value, timestamp?, tags?, units?

### ReporterConfigs
- AWS?: Partial<AWSConfig>
- DataDog?: Partial<DataDogConfig>
- dontSendMetrics?: boolean

---

## Development

### Build
npm run compile

### Tests
npm run utest
npm run coverage
npm run coverage-all   # Includes all source files in coverage

### Lint
npm run lint

---

## Dependencies

- @aws-sdk/client-cloudwatch, @aws-sdk/client-secrets-manager
- datadog-lambda-js
- leo-logger
- async

---

## Branch & PR Conventions

- Base branch: main
- Feature branches: feat/<task-id>-<description>
- Include Jira link in PR: https://chb.atlassian.net/browse/<KEY>
