use sqlx::PgPool;
use taskbolt_auth::password::hash_password;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set (e.g. postgresql://user:pass@host:5432/db)");

    println!("Connecting to database...");
    let pool = PgPool::connect(&database_url).await?;

    println!("Running migrations...");
    sqlx::migrate!("../db/src/migrations").run(&pool).await?;

    println!("Seeding data...");

    // 1. Create tenant
    let tenant_id = Uuid::new_v4();
    sqlx::query("INSERT INTO tenants (id, name, slug, plan) VALUES ($1, $2, $3, $4)")
        .bind(tenant_id)
        .bind("Paraslace")
        .bind("paraslace")
        .bind("pro")
        .execute(&pool)
        .await?;
    println!("  Created tenant: Paraslace");

    // 2. Create admin user
    let admin_id = Uuid::new_v4();
    let seed_password =
        std::env::var("SEED_ADMIN_PASSWORD").expect("SEED_ADMIN_PASSWORD must be set");
    let password_hash = hash_password(&seed_password)
        .await
        .expect("Failed to hash password");

    sqlx::query(
        "INSERT INTO users (id, email, name, password_hash, role, tenant_id) \
         VALUES ($1, $2, $3, $4, $5::user_role, $6)",
    )
    .bind(admin_id)
    .bind("admin1@paraslace.in")
    .bind("Admin")
    .bind(&password_hash)
    .bind("admin")
    .bind(tenant_id)
    .execute(&pool)
    .await?;
    println!("  Created user: Admin (admin1@paraslace.in)");

    // 3. Create workspace
    let workspace_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO workspaces (id, name, description, tenant_id, created_by_id) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(workspace_id)
    .bind("Main")
    .bind("Default workspace")
    .bind(tenant_id)
    .bind(admin_id)
    .execute(&pool)
    .await?;
    println!("  Created workspace: Main");

    // 4. Add workspace member
    sqlx::query("INSERT INTO workspace_members (workspace_id, user_id) VALUES ($1, $2)")
        .bind(workspace_id)
        .bind(admin_id)
        .execute(&pool)
        .await?;
    println!("  Added admin as workspace member");

    // 5. Create project (triggers auto-create default statuses + "General" task list)
    let project_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO projects (id, name, description, workspace_id, tenant_id, created_by_id) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(project_id)
    .bind("My First Project")
    .bind("Getting started")
    .bind(workspace_id)
    .bind(tenant_id)
    .bind(admin_id)
    .execute(&pool)
    .await?;
    println!("  Created project: My First Project");

    // 6. Add admin as project member
    sqlx::query(
        "INSERT INTO project_members (project_id, user_id, role) \
         VALUES ($1, $2, 'editor'::project_member_role)",
    )
    .bind(project_id)
    .bind(admin_id)
    .execute(&pool)
    .await?;
    println!("  Added admin as project member");

    // 7. Create trial subscription
    sqlx::query(
        "INSERT INTO subscriptions (tenant_id, plan_code, status, trial_ends_at) \
         VALUES ($1, $2, 'trialing'::subscription_status, $3)",
    )
    .bind(tenant_id)
    .bind("free")
    .bind(chrono::Utc::now() + chrono::Duration::days(30))
    .execute(&pool)
    .await?;
    println!("  Created trial subscription (30 days)");

    println!("\nSeed completed successfully!");
    println!("  Login: admin1@paraslace.in (password from SEED_ADMIN_PASSWORD env var)");

    Ok(())
}
