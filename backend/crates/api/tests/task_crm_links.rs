mod common;

use common::*;
use http::StatusCode;
use serde_json::json;
use uuid::Uuid;

#[tokio::test]
async fn test_create_contact_link() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_contact_id = Uuid::new_v4();
    let twenty_workspace_id = "workspace-1".to_string();
    let user_id = Uuid::new_v4();

    // Create task
    insert_test_task(&state.db, task_id).await;

    // Link contact
    let client = build_test_client(state.clone()).await;
    let response = client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts",
            task_id
        ))
        .json(&json!({
            "crm_contact_id": crm_contact_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_create_company_link() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_company_id = Uuid::new_v4();
    let twenty_workspace_id = "workspace-1".to_string();

    insert_test_task(&state.db, task_id).await;

    let client = build_test_client(state.clone()).await;
    let response = client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-companies",
            task_id
        ))
        .json(&json!({
            "crm_company_id": crm_company_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_create_deal_link() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_deal_id = Uuid::new_v4();
    let twenty_workspace_id = "workspace-1".to_string();

    insert_test_task(&state.db, task_id).await;

    let client = build_test_client(state.clone()).await;
    let response = client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-deals",
            task_id
        ))
        .json(&json!({
            "crm_deal_id": crm_deal_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_list_contact_links() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_contact_id = Uuid::new_v4();
    let twenty_workspace_id = "workspace-1".to_string();

    insert_test_task(&state.db, task_id).await;

    let client = build_test_client(state.clone()).await;

    // Create link
    client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts",
            task_id
        ))
        .json(&json!({
            "crm_contact_id": crm_contact_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to create link");

    // List links
    let response = client
        .get(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts",
            task_id
        ))
        .send()
        .await
        .expect("Failed to list links");

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.text().await.expect("Failed to read body");
    assert!(body.contains(&crm_contact_id.to_string()));
}

#[tokio::test]
async fn test_list_company_links() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_company_id = Uuid::new_v4();
    let twenty_workspace_id = "workspace-1".to_string();

    insert_test_task(&state.db, task_id).await;

    let client = build_test_client(state.clone()).await;

    // Create link
    client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-companies",
            task_id
        ))
        .json(&json!({
            "crm_company_id": crm_company_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to create link");

    // List links
    let response = client
        .get(format!(
            "http://localhost/api/tasks/{}/linked-crm-companies",
            task_id
        ))
        .send()
        .await
        .expect("Failed to list links");

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.text().await.expect("Failed to read body");
    assert!(body.contains(&crm_company_id.to_string()));
}

#[tokio::test]
async fn test_list_deal_links() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_deal_id = Uuid::new_v4();
    let twenty_workspace_id = "workspace-1".to_string();

    insert_test_task(&state.db, task_id).await;

    let client = build_test_client(state.clone()).await;

    // Create link
    client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-deals",
            task_id
        ))
        .json(&json!({
            "crm_deal_id": crm_deal_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to create link");

    // List links
    let response = client
        .get(format!(
            "http://localhost/api/tasks/{}/linked-crm-deals",
            task_id
        ))
        .send()
        .await
        .expect("Failed to list links");

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.text().await.expect("Failed to read body");
    assert!(body.contains(&crm_deal_id.to_string()));
}

#[tokio::test]
async fn test_delete_contact_link() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_contact_id = Uuid::new_v4();
    let twenty_workspace_id = "workspace-1".to_string();

    insert_test_task(&state.db, task_id).await;

    let client = build_test_client(state.clone()).await;

    // Create link
    client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts",
            task_id
        ))
        .json(&json!({
            "crm_contact_id": crm_contact_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to create link");

    // Delete link
    let response = client
        .delete(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts/{}",
            task_id, crm_contact_id
        ))
        .send()
        .await
        .expect("Failed to delete link");

    assert_eq!(response.status(), StatusCode::OK);

    // Verify deleted
    let list_response = client
        .get(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts",
            task_id
        ))
        .send()
        .await
        .expect("Failed to list links");

    let body = list_response.text().await.expect("Failed to read body");
    assert!(!body.contains(&crm_contact_id.to_string()));
}

#[tokio::test]
async fn test_duplicate_contact_link_rejected() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_contact_id = Uuid::new_v4();
    let twenty_workspace_id = "workspace-1".to_string();

    insert_test_task(&state.db, task_id).await;

    let client = build_test_client(state.clone()).await;

    // Create first link
    let response1 = client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts",
            task_id
        ))
        .json(&json!({
            "crm_contact_id": crm_contact_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to create link");

    assert_eq!(response1.status(), StatusCode::OK);

    // Try to create duplicate
    let response2 = client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts",
            task_id
        ))
        .json(&json!({
            "crm_contact_id": crm_contact_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response2.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_list_all_crm_links() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_contact_id = Uuid::new_v4();
    let crm_company_id = Uuid::new_v4();
    let crm_deal_id = Uuid::new_v4();
    let twenty_workspace_id = "workspace-1".to_string();

    insert_test_task(&state.db, task_id).await;

    let client = build_test_client(state.clone()).await;

    // Create all three link types
    client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts",
            task_id
        ))
        .json(&json!({
            "crm_contact_id": crm_contact_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to create contact link");

    client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-companies",
            task_id
        ))
        .json(&json!({
            "crm_company_id": crm_company_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to create company link");

    client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-deals",
            task_id
        ))
        .json(&json!({
            "crm_deal_id": crm_deal_id,
            "twenty_workspace_id": twenty_workspace_id
        }))
        .send()
        .await
        .expect("Failed to create deal link");

    // Get all links
    let response = client
        .get(format!(
            "http://localhost/api/tasks/{}/linked-crm-all",
            task_id
        ))
        .send()
        .await
        .expect("Failed to get all links");

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.json::<serde_json::Value>().await.expect("Failed to parse JSON");

    // Verify all three types are present
    assert!(body.get("contacts").is_some());
    assert!(body.get("companies").is_some());
    assert!(body.get("deals").is_some());

    let contacts = body["contacts"].as_array().expect("contacts should be array");
    let companies = body["companies"].as_array().expect("companies should be array");
    let deals = body["deals"].as_array().expect("deals should be array");

    assert_eq!(contacts.len(), 1);
    assert_eq!(companies.len(), 1);
    assert_eq!(deals.len(), 1);
}

#[tokio::test]
async fn test_nonexistent_task_rejected() {
    let state = setup_test_state().await;
    let task_id = Uuid::new_v4();
    let crm_contact_id = Uuid::new_v4();

    let client = build_test_client(state.clone()).await;

    let response = client
        .post(format!(
            "http://localhost/api/tasks/{}/linked-crm-contacts",
            task_id
        ))
        .json(&json!({
            "crm_contact_id": crm_contact_id,
            "twenty_workspace_id": "workspace-1"
        }))
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
