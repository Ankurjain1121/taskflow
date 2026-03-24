# HTTP Caching Implementation Guide

This guide explains how to add HTTP caching (Cache-Control headers and ETags) to TaskBolt API endpoints.

## Quick Start

### 1. Cache-Control Headers (Automatic)

The middleware automatically adds appropriate Cache-Control headers to all responses:

```rust
// Middleware in main.rs already handles this
.layer(from_fn(cache_headers_middleware))
```

**What happens:**
- GET `/api/boards/:id` → `Cache-Control: public, max-age=60` (cached for 60s)
- GET `/api/tasks` → `Cache-Control: public, max-age=0, must-revalidate` (always revalidate)
- POST/PUT/DELETE → `Cache-Control: no-cache, no-store, must-revalidate` (never cache)

No code changes needed! The middleware automatically categorizes routes.

### 2. ETag Support (Manual per Endpoint)

To add ETag support to a detail endpoint like `GET /api/boards/:id`:

#### Step 1: Import utilities
```rust
use crate::services::http_cache::{check_if_none_match, generate_etag};
use axum::response::IntoResponse;
```

#### Step 2: Accept HeaderMap
```rust
async fn get_board(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    headers: axum::http::HeaderMap,  // ← Add this parameter
) -> Result<axum::response::Response> {  // ← Change return type
    // ... fetch data
}
```

#### Step 3: Generate ETag and handle conditionals
```rust
// Serialize response to get consistent JSON
let json_str = serde_json::to_string(&response)?;
let etag = generate_etag(&json_str);

// Check If-None-Match header (client has matching ETag)
if check_if_none_match(&headers, &etag) {
    return Ok(axum::response::Response::builder()
        .status(axum::http::StatusCode::NOT_MODIFIED)
        .header("etag", etag)
        .body(axum::body::Body::empty())
        .unwrap());
}

// Return full response with ETag header
let mut response_json = Json(response).into_response();
response_json.headers_mut().insert(
    "etag",
    axum::http::HeaderValue::from_str(&format!("\"{}\"", etag))?,
);
Ok(response_json)
```

## Complete Example: GET /api/tasks/:id

**Before (no ETag):**
```rust
async fn get_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<TaskWithDetails>> {
    let task = get_task_by_id(&state.db, task_id, tenant.user_id).await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;
    Ok(Json(task))
}
```

**After (with ETag):**
```rust
use crate::services::http_cache::{check_if_none_match, generate_etag};
use axum::response::IntoResponse;

async fn get_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    headers: axum::http::HeaderMap,  // ← Add this
) -> Result<axum::response::Response> {  // ← Change return type
    let task = get_task_by_id(&state.db, task_id, tenant.user_id).await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Generate ETag
    let json_str = serde_json::to_string(&task)?;
    let etag = generate_etag(&json_str);

    // Handle conditional request
    if check_if_none_match(&headers, &etag) {
        return Ok(axum::response::Response::builder()
            .status(axum::http::StatusCode::NOT_MODIFIED)
            .header("etag", etag)
            .body(axum::body::Body::empty())
            .unwrap());
    }

    // Return with ETag header
    let mut response_json = Json(task).into_response();
    response_json.headers_mut().insert(
        "etag",
        axum::http::HeaderValue::from_str(&format!("\"{}\"", etag))?,
    );
    Ok(response_json)
}
```

## Cache Categories

The middleware automatically categorizes routes:

### Public Read (max-age=60)
Paths without `/tasks`, `/search`, `/reports`, `/dashboard`, `/metrics`:
```
/api/boards/:id          → cached 60 seconds
/api/workspaces/:id      → cached 60 seconds
/api/columns/:id         → cached 60 seconds
/api/auth/me             → cached 60 seconds
```

### Dynamic (max-age=0, must-revalidate)
Paths containing `/tasks`, `/search`, `/reports`, `/dashboard`, `/metrics`:
```
/api/boards/:id/tasks    → always revalidate (304 possible)
/api/tasks/:id           → always revalidate (304 possible)
/api/search?q=...        → always revalidate
/api/dashboard/...       → always revalidate
/api/reports/...         → always revalidate
```

### No Cache
All POST, PUT, PATCH, DELETE:
```
POST   /api/tasks         → no-cache, no-store
PUT    /api/tasks/:id     → no-cache, no-store
DELETE /api/tasks/:id     → no-cache, no-store
```

## Testing Cache Headers

### Using curl

```bash
# 1. Check Cache-Control header
curl -i https://taskflow.paraslace.in/api/boards/123
# Look for: cache-control: public, max-age=60

# 2. Check ETag header
curl -i https://taskflow.paraslace.in/api/boards/123
# Look for: etag: "a1b2c3d4e5f6..."

# 3. Test 304 Not Modified
curl -i -H 'If-None-Match: "a1b2c3d4e5f6..."' \
    https://taskflow.paraslace.in/api/boards/123
# Should get: 304 Not Modified

# 4. Test mutations don't cache
curl -i -X POST https://taskflow.paraslace.in/api/tasks \
    -H 'Content-Type: application/json' \
    -d '{"title":"Test"}'
# Look for: cache-control: no-cache, no-store, must-revalidate
```

### Using browser DevTools

1. Open DevTools → Network tab
2. Look for response headers:
   - `cache-control: public, max-age=60`
   - `etag: "hash..."`
3. Reload page (Cmd+R):
   - First load: 200 OK with body
   - Second load: 304 Not Modified (no body)

## Frontend Integration

The frontend needs to send `If-None-Match` header for ETag support:

```typescript
// In Angular HTTP interceptor
intercept(req: HttpRequest<any>, next: HttpHandler) {
    const etag = localStorage.getItem(`etag_${req.url}`);
    if (etag && req.method === 'GET') {
        req = req.clone({
            setHeaders: { 'If-None-Match': etag }
        });
    }

    return next.handle(req).pipe(
        tap(event => {
            if (event instanceof HttpResponse) {
                const newEtag = event.headers.get('etag');
                if (newEtag) {
                    localStorage.setItem(`etag_${req.url}`, newEtag);
                }
                // 304 Not Modified - use cached data
                if (event.status === 304) {
                    const cached = localStorage.getItem(`cached_${req.url}`);
                    // Use cached response
                }
            }
        })
    );
}
```

## Middleware Route Categories (cache_headers.rs)

The routing logic in `middleware/cache_headers.rs` determines cache type:

```rust
fn determine_cache_type(method: &Method, path: &str) -> CacheType {
    match *method {
        Method::GET => {
            // Dynamic resources that change frequently
            if path.contains("/tasks") || path.contains("/search")
                || path.contains("/reports") || path.contains("/dashboard")
                || path.contains("/metrics")
            {
                CacheType::Dynamic
            } else {
                // Static resources
                CacheType::PublicRead
            }
        }
        Method::HEAD => CacheType::PublicRead,
        // Mutations never cache
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE => CacheType::NoCache,
        _ => CacheType::NoCache,
    }
}
```

To add a new category, modify this function in `middleware/cache_headers.rs`.

## Performance Impact

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| Reload same board | 200 OK + 5KB JSON | 304 + headers only | 99% |
| Reload board list | 200 OK + 50KB JSON | 304 + headers only | 98% |
| Multiple requests/min | 60 requests | 1 request + 59 ✕ 304s | 85-90% |

**Example:** User with 100 API calls/day:
- Before: 100 full responses ~= 500KB data
- After: ~20 full + 80 ✕ 304 ~= 10KB data
- Savings: 98% bandwidth reduction!

## Troubleshooting

### ETag always changes
- **Problem:** Different JSON serialization (e.g., field order)
- **Solution:** Ensure consistent JSON structure (serde_json is consistent)

### 304 Not Modified not working
- **Problem:** Client not sending If-None-Match header
- **Solution:** Check frontend HTTP interceptor is working

### Cache too aggressive
- **Problem:** User sees stale data
- **Solution:** Reduce max-age or add cache invalidation on mutations

## References

- [RFC 7234: HTTP Caching](https://tools.ietf.org/html/rfc7234)
- [RFC 7232: HTTP Conditional Requests](https://tools.ietf.org/html/rfc7232)
- [Axum Documentation](https://docs.rs/axum/latest/axum/)
- [HTTP Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
- [HTTP ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
