-- Portfolio = keahlian per subkategori, tanpa wajib unggah cover
ALTER TABLE user_portfolios
  ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER user_id;

ALTER TABLE user_portfolios
  ADD INDEX idx_portfolio_category (category_id);

ALTER TABLE user_portfolios
  ADD UNIQUE KEY uq_user_portfolio_cat (user_id, category_id);

ALTER TABLE user_portfolios
  ADD CONSTRAINT fk_portfolio_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
