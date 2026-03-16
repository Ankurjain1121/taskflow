//! Background job: report PDF generator
//!
//! Polls the `report_jobs` table for pending jobs, generates PDFs using genpdf,
//! uploads them to MinIO, and updates the job record with the download URL.

use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

/// Error type for report generation
#[derive(Debug, thiserror::Error)]
pub enum ReportGeneratorError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("PDF generation error: {0}")]
    PdfGeneration(String),
    #[error("S3 upload error: {0}")]
    Upload(String),
}

/// Result of a single report generation cycle
#[derive(Debug)]
pub struct ReportGeneratorResult {
    pub processed: usize,
    pub succeeded: usize,
    pub failed: usize,
}

/// Fetch pending report jobs from the database
async fn fetch_pending_jobs(
    pool: &PgPool,
) -> Result<Vec<taskflow_db::queries::reports::ReportJob>, sqlx::Error> {
    sqlx::query_as::<_, taskflow_db::queries::reports::ReportJob>(
        r#"
        SELECT id, user_id, project_id, report_type, format, status,
               download_url, error_message, created_at, completed_at
        FROM report_jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 10
        "#,
    )
    .fetch_all(pool)
    .await
}

/// Mark a report job as completed with a download URL
async fn mark_completed(pool: &PgPool, job_id: Uuid, download_url: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE report_jobs
        SET status = 'completed', download_url = $2, completed_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .bind(download_url)
    .execute(pool)
    .await?;
    Ok(())
}

/// Mark a report job as failed with an error message
async fn mark_failed(pool: &PgPool, job_id: Uuid, error_message: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE report_jobs
        SET status = 'failed', error_message = $2, completed_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .bind(error_message)
    .execute(pool)
    .await?;
    Ok(())
}

/// Generate a PDF report for a project
fn generate_pdf_bytes(
    report_type: &str,
    project_id: Option<Uuid>,
) -> Result<Vec<u8>, ReportGeneratorError> {
    // Use a built-in font (genpdf ships with a default font)
    let font_family =
        genpdf::fonts::from_files("", "LiberationSans", None).unwrap_or_else(|_| {
            // Fallback: use a minimal built-in approach
            // genpdf requires font files; in production, bundle fonts in the Docker image.
            // For now, attempt system fonts.
            genpdf::fonts::from_files("/usr/share/fonts/truetype/liberation", "LiberationSans", None)
                .unwrap_or_else(|_| {
                    genpdf::fonts::from_files(
                        "/usr/share/fonts/truetype/dejavu",
                        "DejaVuSans",
                        None,
                    )
                    .map_err(|e| ReportGeneratorError::PdfGeneration(format!("No fonts available: {e}")))
                    .expect("No system fonts found — install liberation-fonts or dejavu-fonts")
                })
        });

    let mut doc = genpdf::Document::new(font_family);
    doc.set_title(format!("TaskFlow Report — {}", report_type));
    doc.set_minimal_conformance();

    // Header
    let mut header = genpdf::elements::Paragraph::new(format!(
        "TaskFlow {} Report",
        report_type.replace('_', " ")
    ));
    header.set_alignment(genpdf::Alignment::Center);
    doc.push(header);
    doc.push(genpdf::elements::Break::new(1));

    // Metadata
    let generated_at = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    doc.push(genpdf::elements::Paragraph::new(format!(
        "Generated: {}",
        generated_at
    )));
    if let Some(pid) = project_id {
        doc.push(genpdf::elements::Paragraph::new(format!(
            "Project: {}",
            pid
        )));
    }
    doc.push(genpdf::elements::Break::new(1));

    // Placeholder table
    let mut table = genpdf::elements::TableLayout::new(vec![1, 1, 1]);
    table.set_cell_decorator(genpdf::elements::FrameCellDecorator::new(true, true, false));

    // Header row
    let header_row = table.row();
    header_row
        .element(genpdf::elements::Paragraph::new("Metric"))
        .element(genpdf::elements::Paragraph::new("Value"))
        .element(genpdf::elements::Paragraph::new("Notes"))
        .push()
        .map_err(|e| ReportGeneratorError::PdfGeneration(format!("Table error: {e}")))?;

    // Placeholder data row
    let data_row = table.row();
    data_row
        .element(genpdf::elements::Paragraph::new("Total Tasks"))
        .element(genpdf::elements::Paragraph::new("—"))
        .element(genpdf::elements::Paragraph::new(
            "Data populated at generation time",
        ))
        .push()
        .map_err(|e| ReportGeneratorError::PdfGeneration(format!("Table error: {e}")))?;

    doc.push(table);

    // Render to bytes
    let mut buf = Vec::new();
    doc.render(&mut buf)
        .map_err(|e| ReportGeneratorError::PdfGeneration(format!("Render error: {e}")))?;

    Ok(buf)
}

/// Upload PDF bytes to MinIO and return the object key
async fn upload_to_minio(
    s3_client: &aws_sdk_s3::Client,
    bucket: &str,
    job_id: Uuid,
    pdf_bytes: Vec<u8>,
) -> Result<String, ReportGeneratorError> {
    let key = format!("reports/{}.pdf", job_id);

    s3_client
        .put_object()
        .bucket(bucket)
        .key(&key)
        .body(aws_sdk_s3::primitives::ByteStream::from(pdf_bytes))
        .content_type("application/pdf")
        .send()
        .await
        .map_err(|e| ReportGeneratorError::Upload(format!("S3 put_object failed: {e}")))?;

    Ok(key)
}

/// Process a single report job
async fn process_job(
    pool: &PgPool,
    s3_client: &aws_sdk_s3::Client,
    bucket: &str,
    public_url: &str,
    job: &taskflow_db::queries::reports::ReportJob,
) -> Result<(), ReportGeneratorError> {
    // Mark as processing
    sqlx::query("UPDATE report_jobs SET status = 'processing' WHERE id = $1")
        .bind(job.id)
        .execute(pool)
        .await?;

    // Generate PDF
    let pdf_bytes = generate_pdf_bytes(&job.report_type, job.project_id)?;

    // Upload to MinIO
    let key = upload_to_minio(s3_client, bucket, job.id, pdf_bytes).await?;

    // Build download URL
    let download_url = format!("{}/{}/{}", public_url.trim_end_matches('/'), bucket, key);

    // Mark completed
    mark_completed(pool, job.id, &download_url).await?;

    tracing::info!(job_id = %job.id, report_type = %job.report_type, "Report generated successfully");
    Ok(())
}

/// Run one cycle of the report generator: fetch pending jobs and process them.
pub async fn run_report_generation_cycle(
    pool: &PgPool,
    s3_client: &aws_sdk_s3::Client,
    bucket: &str,
    public_url: &str,
) -> Result<ReportGeneratorResult, ReportGeneratorError> {
    let jobs = fetch_pending_jobs(pool).await?;

    let mut result = ReportGeneratorResult {
        processed: jobs.len(),
        succeeded: 0,
        failed: 0,
    };

    for job in &jobs {
        match process_job(pool, s3_client, bucket, public_url, job).await {
            Ok(()) => result.succeeded += 1,
            Err(e) => {
                tracing::error!(
                    job_id = %job.id,
                    error = %e,
                    "Report generation failed"
                );
                if let Err(db_err) = mark_failed(pool, job.id, &e.to_string()).await {
                    tracing::error!(
                        job_id = %job.id,
                        error = %db_err,
                        "Failed to mark report job as failed"
                    );
                }
                result.failed += 1;
            }
        }
    }

    Ok(result)
}

/// Spawn the report generator as a periodic background task.
/// Polls every 10 seconds for pending report jobs.
pub fn spawn_report_generator(
    pool: PgPool,
    s3_client: aws_sdk_s3::Client,
    bucket: String,
    public_url: String,
) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(10));
        // Skip the first immediate tick
        interval.tick().await;
        tracing::info!("Report generator started (interval: 10s)");

        loop {
            interval.tick().await;
            match run_report_generation_cycle(&pool, &s3_client, &bucket, &public_url).await {
                Ok(result) if result.processed > 0 => {
                    tracing::info!(
                        processed = result.processed,
                        succeeded = result.succeeded,
                        failed = result.failed,
                        "Report generation cycle completed"
                    );
                }
                Ok(_) => {
                    // No pending jobs — quiet tick
                }
                Err(e) => {
                    tracing::error!(error = %e, "Report generation cycle failed");
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_report_generator_error_display() {
        let err = ReportGeneratorError::PdfGeneration("test error".into());
        assert!(err.to_string().contains("test error"));

        let err = ReportGeneratorError::Upload("upload failed".into());
        assert!(err.to_string().contains("upload failed"));
    }

    #[test]
    fn test_report_generator_result_defaults() {
        let result = ReportGeneratorResult {
            processed: 0,
            succeeded: 0,
            failed: 0,
        };
        assert_eq!(result.processed, 0);
    }
}
