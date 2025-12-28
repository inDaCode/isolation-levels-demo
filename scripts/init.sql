-- Тестовая таблица для демонстрации
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0
);

-- Начальные данные
INSERT INTO accounts (name, balance) VALUES
    ('Alice', 1000.00),
    ('Bob', 500.00),
    ('Charlie', 750.00);

-- Таблица для демонстрации phantom reads
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

INSERT INTO products (category, price) VALUES
    ('electronics', 299.99),
    ('electronics', 199.99),
    ('clothing', 49.99);