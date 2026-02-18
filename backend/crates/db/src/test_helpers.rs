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
