-- Roll back only a newly created, still-empty runtime-table set.
-- This script deliberately refuses partial or data-bearing teardown.
DROP PROCEDURE IF EXISTS `rollback_empty_bi_report_business_signal_runtime_tables`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_bi_report_business_signal_runtime_tables`()
BEGIN
  DECLARE business_signal_rows BIGINT DEFAULT 0;
  DECLARE notification_rows BIGINT DEFAULT 0;
  DECLARE decision_rows BIGINT DEFAULT 0;
  DECLARE execution_log_rows BIGINT DEFAULT 0;

  SELECT COUNT(*) INTO business_signal_rows
  FROM `BiReportBusinessSignal`;
  SELECT COUNT(*) INTO notification_rows
  FROM `BiReportSignalNotification`;
  SELECT COUNT(*) INTO decision_rows
  FROM `BiReportBusinessHandoffDecision`;
  SELECT COUNT(*) INTO execution_log_rows
  FROM `BiReportHandoffExecutionLog`;

  IF business_signal_rows + notification_rows + decision_rows + execution_log_rows > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback refused: BI report runtime tables are not empty';
  END IF;

  DROP TABLE `BiReportHandoffExecutionLog`;
  DROP TABLE `BiReportBusinessHandoffDecision`;
  DROP TABLE `BiReportSignalNotification`;
  DROP TABLE `BiReportBusinessSignal`;
END$$

DELIMITER ;

CALL `rollback_empty_bi_report_business_signal_runtime_tables`();
DROP PROCEDURE `rollback_empty_bi_report_business_signal_runtime_tables`;
