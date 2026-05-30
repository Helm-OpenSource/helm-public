-- Synthetic-only public sample query.
-- Downstream forks should replace table names with their own read-only views.

select
  board_date,
  open_case_count,
  review_required_count,
  stale_case_count,
  red_alert
from sample_case_day_board
where board_date = :biz_date
limit 1;
