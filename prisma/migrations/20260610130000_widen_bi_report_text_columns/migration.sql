-- Widen BI-report free-text/JSON columns that real production runs overflow.
-- VARCHAR(191) truncation raised "Data too long" mid-run: BiReportDelivery
-- stores full DingTalk markdown payloads; BiReportRunMemory stores stringified
-- metric arrays and Chinese-prose historical context; feedback memory stores
-- operator notes. These now match the LONGTEXT siblings on BiReportRun /
-- BiReportBusinessSignal.

ALTER TABLE `BiReportDelivery`
    MODIFY `requestBody` LONGTEXT NULL,
    MODIFY `responseBody` LONGTEXT NULL;

ALTER TABLE `BiReportRunMemory`
    MODIFY `summaryMetricsJson` LONGTEXT NOT NULL,
    MODIFY `topFindingsJson` LONGTEXT NOT NULL,
    MODIFY `analysisSummary` LONGTEXT NOT NULL,
    MODIFY `historicalContext` LONGTEXT NULL;

ALTER TABLE `BiReportFeedbackMemory`
    MODIFY `confirmedCause` LONGTEXT NULL,
    MODIFY `confirmedAction` LONGTEXT NULL,
    MODIFY `resolutionOutcome` LONGTEXT NULL,
    MODIFY `note` LONGTEXT NULL;
