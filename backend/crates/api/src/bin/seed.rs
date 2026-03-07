use sqlx::PgPool;
use taskflow_auth::password::hash_password;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://taskflow_app:taskflow_secure_2026@localhost:5432/taskflow".into()
    });

    println!("Connecting to database...");
    let pool = PgPool::connect(&database_url).await?;

    println!("Running migrations...");
    sqlx::migrate!("../db/src/migrations").run(&pool).await?;

    println!("Seeding data...");

    // 1. Create tenant
    let tenant_id = Uuid::new_v4();
    sqlx::query("INSERT INTO tenants (id, name, slug, plan) VALUES ($1, $2, $3, $4)")
        .bind(tenant_id)
        .bind("Acme Corp")
        .bind("acme-corp")
        .bind("pro")
        .execute(&pool)
        .await?;
    println!("  Created tenant: Acme Corp");

    // 2. Create users
    let alice_id = Uuid::new_v4();
    let bob_id = Uuid::new_v4();
    let carol_id = Uuid::new_v4();
    let password_hash = hash_password("password123").expect("Failed to hash password");

    for (id, email, name, role) in [
        (alice_id, "alice@acme.com", "Alice Admin", "admin"),
        (bob_id, "bob@acme.com", "Bob Manager", "manager"),
        (carol_id, "carol@acme.com", "Carol Member", "member"),
    ] {
        sqlx::query(
            "INSERT INTO users (id, email, name, password_hash, role, tenant_id) \
             VALUES ($1, $2, $3, $4, $5::user_role, $6)",
        )
        .bind(id)
        .bind(email)
        .bind(name)
        .bind(&password_hash)
        .bind(role)
        .bind(tenant_id)
        .execute(&pool)
        .await?;
        println!("  Created user: {}", name);
    }

    // 3. Create workspace
    let workspace_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO workspaces (id, name, description, tenant_id, created_by_id) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(workspace_id)
    .bind("Engineering")
    .bind("Engineering team workspace")
    .bind(tenant_id)
    .bind(alice_id)
    .execute(&pool)
    .await?;
    println!("  Created workspace: Engineering");

    // 4. Add workspace members
    for user_id in [alice_id, bob_id, carol_id] {
        sqlx::query("INSERT INTO workspace_members (workspace_id, user_id) VALUES ($1, $2)")
            .bind(workspace_id)
            .bind(user_id)
            .execute(&pool)
            .await?;
    }
    println!("  Added 3 workspace members");

    // 5. Create project (triggers auto-create default statuses + "General" task list)
    let project_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO projects (id, name, description, workspace_id, tenant_id, created_by_id) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(project_id)
    .bind("Sprint 1")
    .bind("Current sprint project")
    .bind(workspace_id)
    .bind(tenant_id)
    .bind(alice_id)
    .execute(&pool)
    .await?;
    println!("  Created project: Sprint 1 (with auto-created statuses and task list)");

    // 6. Add Alice as project member
    sqlx::query(
        "INSERT INTO project_members (project_id, user_id, role) \
         VALUES ($1, $2, 'editor'::project_member_role)",
    )
    .bind(project_id)
    .bind(alice_id)
    .execute(&pool)
    .await?;
    println!("  Added Alice as project member");

    // 7. Fetch the auto-created "Open" (default) status and "General" task list
    let open_status_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM project_statuses WHERE project_id = $1 AND is_default = true LIMIT 1",
    )
    .bind(project_id)
    .fetch_one(&pool)
    .await?;

    let in_progress_status_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM project_statuses WHERE project_id = $1 AND name = 'In Progress' LIMIT 1",
    )
    .bind(project_id)
    .fetch_one(&pool)
    .await?;

    let done_status_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM project_statuses WHERE project_id = $1 AND name = 'Completed' LIMIT 1",
    )
    .bind(project_id)
    .fetch_one(&pool)
    .await?;

    let task_list_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM task_lists WHERE project_id = $1 AND is_default = true LIMIT 1",
    )
    .bind(project_id)
    .fetch_one(&pool)
    .await?;

    println!("  Fetched auto-created statuses and task list");

    // 8. Create sample tasks
    let tasks = [
        ("Set up CI/CD pipeline", "urgent", open_status_id, "a0", alice_id),
        ("Design database schema", "high", open_status_id, "a1", bob_id),
        ("Implement user auth", "high", in_progress_status_id, "a2", alice_id),
        ("Create API endpoints", "medium", in_progress_status_id, "a3", carol_id),
        ("Write unit tests", "low", done_status_id, "a4", bob_id),
    ];

    let mut task_ids = Vec::new();
    for (title, priority, status_id, position, assignee_id) in tasks {
        let task_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO tasks \
             (id, title, priority, project_id, status_id, task_list_id, position, tenant_id, created_by_id) \
             VALUES ($1, $2, $3::task_priority, $4, $5, $6, $7, $8, $9)",
        )
        .bind(task_id)
        .bind(title)
        .bind(priority)
        .bind(project_id)
        .bind(status_id)
        .bind(task_list_id)
        .bind(position)
        .bind(tenant_id)
        .bind(alice_id)
        .execute(&pool)
        .await?;

        sqlx::query("INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)")
            .bind(task_id)
            .bind(assignee_id)
            .execute(&pool)
            .await?;

        task_ids.push(task_id);
        println!("  Created task: {}", title);
    }

    // 9. Create sample comments
    sqlx::query(
        "INSERT INTO comments (content, task_id, author_id, mentioned_user_ids) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind("Let's prioritize this for the sprint!")
    .bind(task_ids[0])
    .bind(alice_id)
    .bind(serde_json::json!([]))
    .execute(&pool)
    .await?;

    sqlx::query(
        "INSERT INTO comments (content, task_id, author_id, mentioned_user_ids) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind("@Bob can you take a look at the config?")
    .bind(task_ids[0])
    .bind(carol_id)
    .bind(serde_json::json!([bob_id]))
    .execute(&pool)
    .await?;
    println!("  Created 2 sample comments");

    // 10. Create trial subscription
    sqlx::query(
        "INSERT INTO subscriptions (tenant_id, plan_code, status, trial_ends_at) \
         VALUES ($1, $2, 'trialing'::subscription_status, $3)",
    )
    .bind(tenant_id)
    .bind("free")
    .bind(chrono::Utc::now() + chrono::Duration::days(15))
    .execute(&pool)
    .await?;
    println!("  Created trial subscription (15 days)");

    println!("\nSeed completed successfully!");
    println!("  Login: alice@acme.com / password123");
    println!("  Login: bob@acme.com / password123");
    println!("  Login: carol@acme.com / password123");

    Ok(())
}
