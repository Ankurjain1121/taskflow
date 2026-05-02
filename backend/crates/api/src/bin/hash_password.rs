use taskbolt_auth::password::hash_password;

#[tokio::main]
async fn main() {
    let password = std::env::args()
        .nth(1)
        .expect("Usage: hash_password <password>");
    let hash = hash_password(&password)
        .await
        .expect("Failed to hash password");
    println!("{}", hash);
}
