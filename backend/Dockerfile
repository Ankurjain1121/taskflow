# =============================================================================
# TaskFlow Backend - Multi-stage Docker Build
# =============================================================================
# Uses cargo-chef for dependency caching to speed up builds
# Final image is minimal (<150MB) with only the compiled binary
# =============================================================================

# Stage 1: Chef - Install cargo-chef
FROM rust:1.93-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

# Stage 2: Planner - Analyze dependencies
FROM chef AS planner
COPY Cargo.toml ./
# Cargo.lock is optional - will be regenerated if missing
COPY Cargo.loc[k] ./
COPY crates/api/Cargo.toml crates/api/
COPY crates/db/Cargo.toml crates/db/
COPY crates/auth/Cargo.toml crates/auth/
COPY crates/services/Cargo.toml crates/services/
# Create stub files so cargo can read the workspace
RUN mkdir -p crates/api/src crates/db/src crates/auth/src crates/services/src && \
    echo "fn main() {}" > crates/api/src/main.rs && \
    echo "" > crates/db/src/lib.rs && \
    echo "" > crates/auth/src/lib.rs && \
    echo "" > crates/services/src/lib.rs
RUN cargo chef prepare --recipe-path recipe.json

# Stage 3: Builder - Build dependencies then application
FROM chef AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install sqlx-cli for running migrations
RUN cargo install sqlx-cli --no-default-features --features rustls,postgres

# Copy recipe and build dependencies (cached layer)
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Copy full source and build application
COPY . .
# Set SQLX_OFFLINE=true to skip compile-time query verification
# This trusts that the queries are correct without needing a database connection
ENV SQLX_OFFLINE=true
RUN cargo build --release --bin taskflow-api

# Stage 4: Runner - Minimal runtime image
FROM ubuntu:24.04 AS runner

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3t64 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd --system --no-create-home --shell /usr/sbin/nologin app

# Copy compiled binary
COPY --from=builder /app/target/release/taskflow-api /usr/local/bin/taskflow-api

# Copy entrypoint and init scripts
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY scripts/init-db.sh /usr/local/bin/init-db.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /usr/local/bin/init-db.sh

# Switch to non-root user
USER app

# Expose API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Run entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
