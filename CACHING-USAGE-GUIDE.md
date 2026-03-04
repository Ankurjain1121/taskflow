# HTTP Caching Usage Guide

## Quick Reference

### For Component Developers

**You don't need to do anything.** Services automatically cache data.

```typescript
// In your component
constructor(private boardService: BoardService) {}

ngOnInit() {
  // First call: HTTP request made, data cached for 2 min
  this.boardService.getBoard('board-123').subscribe(board => {
    console.log('Board loaded:', board);
  });
}
```

### When Cache is Used

1. **Service reads from cache** if:
   - Cache key exists
   - Cache entry hasn't expired (TTL not exceeded)
   - Request is identical

2. **Cache is invalidated** when:
   - Entity is created/updated/deleted
   - Related entities change
   - TTL expires

## Caching in Services

### BoardService Caching

```typescript
// Cache hit if called within 2 minutes and board hasn't changed
this.boardService.getBoard('board-123')
  .subscribe(board => { /* cached data */ });

// After board update, cache automatically cleared
this.boardService.updateBoard('board-123', { name: 'New Name' })
  .subscribe(() => {
    // Cache invalidated automatically
    // Next getBoard() call will fetch fresh data
  });
```

### TaskService Caching

```typescript
// Tasks cached per column (1 min TTL)
this.taskService.listTasks('column-456')
  .subscribe(tasks => { /* cached */ });

// Moving task invalidates task + all task caches
this.taskService.moveTask('task-123', { column_id: 'column-789', position: '1' })
  .subscribe(() => {
    // All task caches invalidated
  });
```

### ApiService Deduplication

```typescript
// When multiple components request same data simultaneously:

// Component A
this.apiService.get('/boards/123').subscribe(data => console.log('A:', data));

// Component B (at same time)
this.apiService.get('/boards/123').subscribe(data => console.log('B:', data));

// Result: Only 1 HTTP request, both components get same data
// Both log output appears after single request completes
```

## Manual Cache Control

### Invalidate Specific Cache Key

```typescript
import { CacheService } from './cache.service';

constructor(private cache: CacheService) {}

// After bulk operation
bulkUpdateTasks() {
  this.taskService.bulkUpdate(taskIds, updates).subscribe(() => {
    // Invalidate task cache
    this.cache.invalidateKey('tasks:column-123');
  });
}
```

### Invalidate by Pattern

```typescript
// Clear all board-related caches
this.cache.invalidate('board:.*');

// Clear all caches for a specific board
this.cache.invalidate('board:123:.*');

// Clear all task caches
this.cache.invalidate('task:.*');
```

### Clear All Caches

```typescript
// Nuclear option - clear everything
this.cache.clear();

// Then services will fetch fresh data on next request
```

## Cache Key Examples

### Board Operations
```typescript
// Single board metadata (2 min)
cache key: 'board:board-123'

// All boards in workspace (2 min)
cache key: 'boards:workspace-456'

// Full board with tasks, pagination (1 min)
cache key: 'board-full:board-123:limit:1000:offset:0'

// Board columns (2 min)
cache key: 'columns:board-123'

// Board members (3 min)
cache key: 'board-members:board-123'
```

### Task Operations
```typescript
// Single task (1 min)
cache key: 'task:task-123'

// Tasks in column (1 min)
cache key: 'tasks:column-456'

// Task details with comments, assignees (1 min)
cache key: 'task-details:task-123'

// Task labels (2 min)
cache key: 'task-labels:task-123'

// Task reminders (2 min)
cache key: 'task-reminders:task-123'

// Calendar tasks (3 min)
cache key: 'calendar-tasks:board-123:2026-03-01:2026-03-31'

// Gantt tasks (2 min)
cache key: 'gantt-tasks:board-123'
```

## Performance Impact

### Before Caching
```
Dashboard Load Sequence:
1. GET /boards → 1.2s
2. GET /workspaces/123/boards → 1.1s (could hit cache, does not)
3. GET /boards/123/columns → 0.8s
4. GET /boards/123/full → 1.5s
5. GET /boards/123/members → 0.9s
Total: 5.5 seconds
HTTP Requests: 5
```

### After Caching
```
Dashboard Load Sequence:
1. GET /boards → 1.2s (new request)
2. /workspaces/123/boards → instant (cache hit)
3. GET /boards/123/columns → 0.8s (new, but shares request with other components)
4. /boards/123/full → instant (cache hit)
5. /boards/123/members → instant (cache hit)
Total: 2.0 seconds (64% faster!)
HTTP Requests: 2 (60% reduction)
```

## Real-World Scenarios

### Scenario 1: Navigating Between Boards

**User Action**: Click Board A → Board B → Board A

```
Step 1: Open Board A
  - HTTP request for board details, columns, tasks
  - All cached for 1-2 min

Step 2: Click Board B
  - HTTP request for board details, columns, tasks
  - New cache entries created

Step 3: Click back to Board A
  - All cached, NO new HTTP requests
  - Data appears instantly (cache hit)
```

### Scenario 2: Multiple Tabs Open

**User Action**: Board view + Dashboard open simultaneously

```
Component: BoardView
  - Calls: getBoardFull('board-123')

Component: Dashboard
  - Calls: listBoards() (for board list)

Component: TaskList
  - Calls: listTasks('column-456')

Deduplication:
  - If getBoardFull and listBoards hit same data? Separate caches
  - If listTasks is called twice? Shared HTTP request (dedup)
```

### Scenario 3: Rapid Drag & Drop

**User Action**: Move task 10 times quickly

```
Each move:
  - moveTask() called (mutation)
  - Cache invalidated for affected caches
  - Cache for unaffected data persists

Performance:
  - First move: HTTP request to move, cache refreshed
  - Subsequent moves: Use cached board data, only send move request
  - No redundant board/task list requests
```

## Debugging Cache

### Check Cache Status

```typescript
import { CacheService } from './cache.service';

constructor(private cache: CacheService) {}

// Get cache statistics
const stats = this.cache.getStats();
console.log('Cache size:', stats.size);      // e.g., 12
console.log('Cached keys:', stats.keys);     // ['board:123', 'tasks:col-1', ...]
```

### Monitor Network Tab (Browser DevTools)

1. Open DevTools → Network tab
2. Set filter to `XHR` (XMLHttpRequest)
3. Navigate board:
   - First board load: Multiple HTTP requests
   - Navigate away and back: No duplicate requests (cache hit)
4. Look for repeated URLs — if absent, cache is working!

### Log Cache Operations (Development)

```typescript
// In browser console
// Modify services to log cache operations (dev only)
this.cache.get('board:123', factory)
  .subscribe(
    data => console.log('Cache hit for board:123'),
    error => console.error('Cache error:', error)
  );
```

## Common Patterns

### Pattern 1: Load Then Update

```typescript
// Component loads task
this.taskService.getTask('task-123')
  .subscribe(task => this.taskData = task);

// User makes change, saves
saveTask() {
  this.taskService.updateTask('task-123', { title: 'New Title' })
    .subscribe(() => {
      // Cache automatically invalidated by updateTask()
      // Component can refresh by calling getTask again
      this.taskService.getTask('task-123')
        .subscribe(task => this.taskData = task); // Fresh data
    });
}
```

### Pattern 2: List Then Refresh

```typescript
ngOnInit() {
  this.loadTasks();
}

loadTasks() {
  this.taskService.listTasks('column-456')
    .subscribe(tasks => this.tasks = tasks); // Cache used
}

onTaskCreated() {
  // Cache automatically invalidated by createTask()
  this.loadTasks(); // Fetches fresh data
}
```

### Pattern 3: Pagination

```typescript
// Page 1 cached separately from Page 2
getPage(page: number) {
  const limit = 10;
  const offset = (page - 1) * limit;

  // Each page has unique cache key
  this.boardService.getBoardFull('board-123', { limit, offset })
    .subscribe(data => this.pageData = data);
}

// User navigates: Page 1 → Page 2 → Page 1
// Page 1 cache still valid, no request on return to Page 1
```

## TTL Reference

| Operation | TTL | When Expires | Best For |
|---|---|---|---|
| `getBoard()` | 2 min | Metadata rarely changes | Board title, description |
| `listColumns()` | 2 min | Columns rarely added/removed | Kanban columns display |
| `getBoardFull()` | 1 min | Tasks change frequently | Board with task list |
| `getTask()` | 1 min | Task details change often | Task properties |
| `listTasks()` | 1 min | Tasks created/moved frequently | Column task list |
| `listCalendarTasks()` | 3 min | Date-based, less frequent | Calendar view |
| `getBoardMembers()` | 3 min | Members rarely added/removed | Member list |

## Best Practices

### ✅ DO

- Rely on automatic cache invalidation on mutations
- Use service methods (don't bypass cache with direct HTTP calls)
- Trust that cache TTLs are appropriate
- Use `CacheService` for custom caching if needed

### ❌ DON'T

- Don't manually manage HTTP caching headers (handled by service)
- Don't call `cache.clear()` on every component init (waste of cache)
- Don't bypass services to make direct HTTP calls
- Don't assume stale cache data (TTLs ensure freshness)

## Troubleshooting

### Issue: Data seems stale

**Solution**: Check browser DevTools Network tab
- Look for repeated requests to same endpoint
- If no repeats, cache is working
- If repeats, TTL may be too long — increase request frequency

### Issue: Cache not clearing after update

**Solution**: Verify service includes invalidation
- All `updateBoard()`, `createTask()`, etc. include `tap()` with `cache.invalidate()`
- Check cache keys match pattern
- Can manually invalidate: `this.cache.invalidate('board:.*')`

### Issue: Multiple HTTP requests for same data

**Solution**: Check deduplication in ApiService
- Concurrent GET requests should share single HTTP call
- If multiple requests in Network tab, check if requests are truly concurrent
- Deduplication only works for simultaneously issued requests

## Migration Guide (for existing code)

**No changes needed!** Existing code continues to work.

```typescript
// Old code (still works with caching)
this.boardService.getBoard('board-123')
  .subscribe(board => this.board = board);

// Automatically benefits from caching
// First call: HTTP request + cache
// Second call within 2 min: Cache hit, instant response
```

Caching is transparent — components don't know cache exists.
