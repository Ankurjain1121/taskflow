use taskflow_auth::password::hash_password;

fn main() {
    let password = std::env::args().nth(1).expect("Usage: hash_password <password>");
    let hash = hash_password(&password).expect("Failed to hash password");
    println!("{}", hash);
}
