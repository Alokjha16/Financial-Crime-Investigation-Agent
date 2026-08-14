CREATE TABLE IF NOT EXISTS accounts (
    account_id VARCHAR(255) PRIMARY KEY,
    bank_id VARCHAR(255) NOT NULL,
    account_type ENUM('personal', 'business') DEFAULT 'personal',
    account_age_days INT DEFAULT 365,
    kyc_status ENUM('complete', 'incomplete', 'pending', 'rejected') DEFAULT 'pending',
    is_business BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bank_id (bank_id),
    INDEX idx_kyc_status (kyc_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id VARCHAR(255) PRIMARY KEY,
    from_bank_id VARCHAR(255) NOT NULL,
    from_account_id VARCHAR(255) NOT NULL,
    to_bank_id VARCHAR(255) NOT NULL,
    to_account_id VARCHAR(255) NOT NULL,
    amount_paid DOUBLE NOT NULL,
    payment_currency VARCHAR(10) NOT NULL,
    amount_received DOUBLE NOT NULL,
    receiving_currency VARCHAR(10) NOT NULL,
    payment_format VARCHAR(50) NOT NULL,
    timestamp DATETIME NOT NULL,
    transaction_hour INT NOT NULL,
    is_laundering BOOLEAN DEFAULT FALSE,
    laundering_pattern VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_from_account (from_account_id),
    INDEX idx_to_account (to_account_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_is_laundering (is_laundering),
    INDEX idx_laundering_pattern (laundering_pattern),
    FOREIGN KEY (from_account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
    FOREIGN KEY (to_account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kyc (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    id_number VARCHAR(255),
    id_type VARCHAR(100),
    date_of_birth DATETIME,
    nationality VARCHAR(100),
    address TEXT,
    phone_number VARCHAR(50),
    email VARCHAR(255),
    occupation VARCHAR(255),
    employer VARCHAR(255),
    completeness_score DOUBLE DEFAULT 0.0,
    verified BOOLEAN DEFAULT FALSE,
    verification_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_kyc_account (account_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_account_id VARCHAR(255) NOT NULL,
    to_account_id VARCHAR(255) NOT NULL,
    link_type VARCHAR(100) NOT NULL,
    strength DOUBLE DEFAULT 1.0,
    is_suspicious BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_from_account (from_account_id),
    INDEX idx_to_account (to_account_id),
    FOREIGN KEY (from_account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
    FOREIGN KEY (to_account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    complaint_type VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(100) DEFAULT 'open',
    filed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    INDEX idx_complaint_account (account_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cases (
    case_id VARCHAR(255) PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    status ENUM('new', 'under_investigation', 'under_review', 'escalated', 'closed', 'false_positive') DEFAULT 'new',
    risk_score INT,
    risk_level VARCHAR(50),
    typology VARCHAR(100),
    evidence JSON,
    recommendation VARCHAR(100),
    decision ENUM('escalate', 'clear', 'false_positive', 'review'),
    decision_notes TEXT,
    decided_by VARCHAR(255),
    decided_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_case_status (status),
    INDEX idx_case_created (created_at),
    INDEX idx_case_typology (typology),
    INDEX idx_case_account (account_id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evidence (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id VARCHAR(255) NOT NULL,
    evidence_type VARCHAR(100) NOT NULL,
    description TEXT,
    source VARCHAR(255),
    data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_evidence_case (case_id),
    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    actor_type VARCHAR(100) NOT NULL,
    details JSON,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_case (case_id),
    INDEX idx_audit_timestamp (timestamp),
    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
