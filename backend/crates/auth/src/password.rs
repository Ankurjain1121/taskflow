use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

/// Hash a password using Argon2id
pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

/// Verify a password against a stored hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
    let parsed_hash = PasswordHash::new(hash)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let password = "test_password_123";
        let hash = hash_password(password).unwrap();
        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_empty_password() {
        let result = hash_password("");
        assert!(result.is_ok(), "Argon2 should allow hashing an empty password");
        let hash = result.unwrap();
        assert!(verify_password("", &hash).unwrap());
    }

    #[test]
    fn test_long_password() {
        let long_password = "a".repeat(1000);
        let result = hash_password(&long_password);
        assert!(result.is_ok(), "Argon2 should handle a 1000-char password");
        let hash = result.unwrap();
        assert!(verify_password(&long_password, &hash).unwrap());
    }

    #[test]
    fn test_hash_format_starts_with_argon2() {
        let hash = hash_password("some_password").unwrap();
        assert!(
            hash.starts_with("$argon2"),
            "Hash should start with $argon2, got: {}",
            hash
        );
    }

    #[test]
    fn test_different_passwords_different_hashes() {
        let hash1 = hash_password("password_one").unwrap();
        let hash2 = hash_password("password_two").unwrap();
        assert_ne!(hash1, hash2, "Different passwords should produce different hashes");
    }

    #[test]
    fn test_verify_with_invalid_hash_format() {
        let result = verify_password("any_password", "not-a-valid-hash");
        assert!(result.is_err(), "Invalid hash format should return Err");
    }
}
