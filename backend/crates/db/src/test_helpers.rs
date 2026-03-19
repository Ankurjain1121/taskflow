/// Create a test database connection pool from DATABASE_URL environment variable.
/// Loads .env file automatically so tests work without manual env setup.
pub async fn test_pool() -> sqlx::PgPool {
    let _ = dotenvy::from_path("../../.env");
    let _ = dotenvy::dotenv();
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for tests");
    sqlx::PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database")
}

#[cfg(test)]
pub mod fixtures {
    use uuid::Uuid;

    pub fn random_uuid() -> Uuid {
        Uuid::new_v4()
    }

    pub fn random_email() -> String {
        format!("test-{}@example.com", Uuid::new_v4().as_simple())
    }

    pub fn random_name() -> String {
        format!("Test User {}", &Uuid::new_v4().to_string()[..8])
    }
}
