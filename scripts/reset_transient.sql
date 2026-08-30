-- 选择性重置易失数据（防止窜 bug）：旧新闻条目 / 推送记录 / 抓取记录 / 前端缓存
DELETE FROM items;
DELETE FROM push_records;
DELETE FROM crawl_records;
DELETE FROM cache;
