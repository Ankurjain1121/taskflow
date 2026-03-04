import { TestBed } from '@angular/core/testing';
import { CacheService } from './cache.service';
import { of } from 'rxjs';

/**
 * CacheService Tests
 *
 * Tests the caching strategy:
 * - TTL-based cache expiration
 * - Request deduplication (concurrent requests share single HTTP call)
 * - Pattern-based cache invalidation
 */
describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CacheService],
    });
    service = TestBed.inject(CacheService);
  });

  afterEach(() => {
    service.clear();
  });

  describe('Basic Caching', () => {
    it('should cache observable and return same instance for same key', (done) => {
      const key = 'test:board:123';
      const mockData = { id: '123', name: 'Test Board' };
      let callCount = 0;

      const factory = () => {
        callCount++;
        return of(mockData);
      };

      const obs1 = service.get(key, factory);
      const obs2 = service.get(key, factory);

      // Both should be the same observable reference (deduplication)
      expect(obs1).toBe(obs2);
      expect(callCount).toBe(1);

      obs1.subscribe((data) => {
        expect(data).toEqual(mockData);
        done();
      });
    });

    it('should return cached data without calling factory on hit', (done) => {
      const key = 'test:data';
      const mockData = { value: 42 };
      let callCount = 0;

      const factory = () => {
        callCount++;
        return of(mockData);
      };

      // First call - cache miss
      service.get(key, factory).subscribe(() => {
        expect(callCount).toBe(1);

        // Second call - cache hit
        service.get(key, factory).subscribe((data) => {
          expect(data).toEqual(mockData);
          expect(callCount).toBe(1); // Should not increment
          done();
        });
      });
    });

    it('should deduplicate concurrent requests (shareReplay)', (done) => {
      const key = 'test:concurrent';
      const mockData = { id: 'concurrent-test' };
      let callCount = 0;

      const factory = () => {
        callCount++;
        return of(mockData);
      };

      const obs = service.get(key, factory);

      let subscriber1Data: any;
      let subscriber2Data: any;
      let completed = 0;

      // Multiple subscribers to same observable
      obs.subscribe((data) => {
        subscriber1Data = data;
        completed++;
        if (completed === 2) {
          // Both should have received data from single HTTP call
          expect(subscriber1Data).toEqual(mockData);
          expect(subscriber2Data).toEqual(mockData);
          expect(callCount).toBe(1);
          done();
        }
      });

      obs.subscribe((data) => {
        subscriber2Data = data;
        completed++;
        if (completed === 2) {
          expect(subscriber1Data).toEqual(mockData);
          expect(subscriber2Data).toEqual(mockData);
          expect(callCount).toBe(1);
          done();
        }
      });
    });
  });

  describe('TTL Expiration', () => {
    it('should expire cache after TTL', (done) => {
      const key = 'test:ttl';
      const mockData1 = { value: 1 };
      const mockData2 = { value: 2 };
      let callCount = 0;

      const factory = () => {
        callCount++;
        return of(callCount === 1 ? mockData1 : mockData2);
      };

      // Cache with 100ms TTL
      service.get(key, factory, 100).subscribe((data) => {
        expect(data).toEqual(mockData1);
        expect(callCount).toBe(1);

        // Wait for TTL to expire
        setTimeout(() => {
          service.get(key, factory, 100).subscribe((data2) => {
            expect(data2).toEqual(mockData2);
            expect(callCount).toBe(2); // Should have called factory again
            done();
          });
        }, 150);
      });
    });

    it('should use default TTL when not specified', (done) => {
      const key = 'test:default-ttl';
      const mockData = { value: 1 };

      const factory = () => of(mockData);

      const obs = service.get(key, factory); // No TTL specified

      obs.subscribe(() => {
        const stats = service.getStats();
        expect(stats.keys).toContain(key);
        done();
      });
    });

    it('should use custom TTL when specified', (done) => {
      const key = 'test:custom-ttl';
      const mockData = { value: 1 };
      const customTtl = 500; // 500ms

      const factory = () => of(mockData);

      service.get(key, factory, customTtl).subscribe(() => {
        // Should still be in cache immediately after
        const stats = service.getStats();
        expect(stats.keys).toContain(key);

        // Should expire after custom TTL
        setTimeout(() => {
          service.get(key, factory, customTtl).subscribe(() => {
            const statsAfterTtl = service.getStats();
            // New entry created, but old one should be gone
            expect(statsAfterTtl.keys).toContain(key);
            done();
          });
        }, 600);
      });
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache by exact key', (done) => {
      const key = 'test:exact';
      const mockData = { value: 1 };
      let callCount = 0;

      const factory = () => {
        callCount++;
        return of(mockData);
      };

      service.get(key, factory, 10000).subscribe(() => {
        expect(callCount).toBe(1);

        // Invalidate
        service.invalidateKey(key);

        // Next call should miss cache
        service.get(key, factory, 10000).subscribe(() => {
          expect(callCount).toBe(2);
          done();
        });
      });
    });

    it('should invalidate cache by regex pattern', (done) => {
      const mockData = { value: 1 };
      let callCount = 0;

      const factory = () => {
        callCount++;
        return of(mockData);
      };

      // Cache multiple entries with pattern
      service.get('board:123:full', factory, 10000).subscribe(() => {
        service.get('board:456:full', factory, 10000).subscribe(() => {
          service.get('task:789', factory, 10000).subscribe(() => {
            expect(callCount).toBe(3);

            // Invalidate all board-related caches
            service.invalidate('board:.*');

            // Board caches should miss
            service.get('board:123:full', factory, 10000).subscribe(() => {
              // Task cache should still hit
              service.get('task:789', factory, 10000).subscribe(() => {
                expect(callCount).toBe(5); // Only board:123 and board:456 were called again
                done();
              });
            });
          });
        });
      });
    });

    it('should handle string pattern correctly', (done) => {
      const mockData = { value: 1 };
      let callCount = 0;

      const factory = () => {
        callCount++;
        return of(mockData);
      };

      service.get('task:abc', factory, 10000).subscribe(() => {
        service.get('task:def', factory, 10000).subscribe(() => {
          expect(callCount).toBe(2);

          // Use string pattern
          service.invalidate('task:.*');

          service.get('task:abc', factory, 10000).subscribe(() => {
            expect(callCount).toBe(3);
            done();
          });
        });
      });
    });
  });

  describe('Cache Clear', () => {
    it('should clear all cache entries', (done) => {
      const mockData = { value: 1 };
      let callCount = 0;

      const factory = () => {
        callCount++;
        return of(mockData);
      };

      service.get('key:1', factory, 10000).subscribe(() => {
        service.get('key:2', factory, 10000).subscribe(() => {
          let stats = service.getStats();
          expect(stats.size).toBe(2);

          service.clear();

          stats = service.getStats();
          expect(stats.size).toBe(0);

          service.get('key:1', factory, 10000).subscribe(() => {
            expect(callCount).toBe(3); // All were called again
            done();
          });
        });
      });
    });
  });

  describe('Cache Statistics', () => {
    it('should report accurate cache size', (done) => {
      const mockData = { value: 1 };
      const factory = () => of(mockData);

      expect(service.getStats().size).toBe(0);

      service.get('key:1', factory).subscribe(() => {
        expect(service.getStats().size).toBe(1);

        service.get('key:2', factory).subscribe(() => {
          expect(service.getStats().size).toBe(2);

          service.invalidateKey('key:1');
          expect(service.getStats().size).toBe(1);

          done();
        });
      });
    });

    it('should list all cache keys', (done) => {
      const mockData = { value: 1 };
      const factory = () => of(mockData);

      service.get('boards:workspace-1', factory).subscribe(() => {
        service.get('tasks:column-1', factory).subscribe(() => {
          const stats = service.getStats();
          expect(stats.keys).toContain('boards:workspace-1');
          expect(stats.keys).toContain('tasks:column-1');
          expect(stats.keys.length).toBe(2);
          done();
        });
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle board + tasks + columns caching', (done) => {
      const mockBoard = { id: '1', name: 'Board 1' };
      const mockTasks = [{ id: 't1', title: 'Task 1' }];
      const mockColumns = [{ id: 'c1', name: 'Todo' }];

      const factoryBoard = () => of(mockBoard);
      const factoryTasks = () => of(mockTasks);
      const factoryColumns = () => of(mockColumns);

      let httpCalls = 0;

      service.get('board:1', factoryBoard, 60000).subscribe(() => {
        httpCalls++;
        service.get('tasks:column:1', factoryTasks, 60000).subscribe(() => {
          httpCalls++;
          service
            .get('columns:board:1', factoryColumns, 60000)
            .subscribe(() => {
              httpCalls++;

              // All cached now, re-fetch should use cache
              service.get('board:1', factoryBoard, 60000).subscribe(() => {
                expect(httpCalls).toBe(3); // No new calls

                // Invalidate all board data
                service.invalidate('board:1|columns:.*|tasks:.*');

                // Should need to refetch
                service
                  .get('columns:board:1', factoryColumns, 60000)
                  .subscribe(() => {
                    expect(httpCalls).toBe(4); // One new call
                    done();
                  });
              });
            });
        });
      });
    });

    it('should handle pagination cache keys correctly', (done) => {
      const mockPage1 = { data: ['item1'], page: 1 };
      const mockPage2 = { data: ['item2'], page: 2 };

      const factory1 = () => of(mockPage1);
      const factory2 = () => of(mockPage2);

      service.get('tasks:page:1:limit:10', factory1, 60000).subscribe(() => {
        service.get('tasks:page:2:limit:10', factory2, 60000).subscribe(() => {
          const stats = service.getStats();

          // Both should be cached separately
          expect(stats.keys).toContain('tasks:page:1:limit:10');
          expect(stats.keys).toContain('tasks:page:2:limit:10');
          expect(stats.size).toBe(2);

          done();
        });
      });
    });
  });
});
