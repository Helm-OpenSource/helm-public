-- Widen BI report run JSON/error fields so LLM metadata and analysis payloads
-- are not truncated to 191 chars when persisted.

SET @stmt = (
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'BiReportRun'
        AND column_name = 'querySummaryJson'
    ) THEN
      'ALTER TABLE `BiReportRun`
        MODIFY COLUMN `querySummaryJson` LONGTEXT NULL,
        MODIFY COLUMN `metricsJson` LONGTEXT NULL,
        MODIFY COLUMN `criteriaResultJson` LONGTEXT NULL,
        MODIFY COLUMN `deterministicSummaryJson` LONGTEXT NULL,
        MODIFY COLUMN `analysisJson` LONGTEXT NULL,
        MODIFY COLUMN `llmMetaJson` LONGTEXT NULL,
        MODIFY COLUMN `errorSummary` LONGTEXT NULL'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_run'
        AND column_name = 'query_summary_json'
    ) THEN
      'ALTER TABLE `bi_report_run`
        MODIFY COLUMN `query_summary_json` LONGTEXT NULL,
        MODIFY COLUMN `metrics_json` LONGTEXT NULL,
        MODIFY COLUMN `criteria_result_json` LONGTEXT NULL,
        MODIFY COLUMN `deterministic_summary_json` LONGTEXT NULL,
        MODIFY COLUMN `analysis_json` LONGTEXT NULL,
        MODIFY COLUMN `llm_meta_json` LONGTEXT NULL,
        MODIFY COLUMN `error_summary` LONGTEXT NULL'
    ELSE 'SELECT 1'
  END
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
