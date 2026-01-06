export const SETUP_SQL = `
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS products;

CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0
);

INSERT INTO accounts (name, balance) VALUES
  ('Alice', 1000),
  ('Bob', 500),
  ('Charlie', 750);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  price INTEGER NOT NULL
);

INSERT INTO products (category, price) VALUES
  ('electronics', 299),
  ('electronics', 199),
  ('clothing', 49);
`;
