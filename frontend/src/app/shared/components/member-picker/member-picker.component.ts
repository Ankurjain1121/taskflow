import {
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoComplete } from 'primeng/autocomplete';
import { Subject, debounceTime, switchMap, of } from 'rxjs';
import {
  WorkspaceService,
  MemberSearchResult,
} from '../../../core/services/workspace.service';

@Component({
  selector: 'app-member-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoComplete],
  template: `
    <p-autoComplete
      [(ngModel)]="searchQuery"
      [suggestions]="results()"
      (completeMethod)="onSearch($event)"
      (onSelect)="onSelected($event)"
      [placeholder]="placeholder()"
      field="name"
      [forceSelection]="true"
      [minLength]="2"
      class="w-full"
    >
      <ng-template let-member #item>
        <div class="flex items-center gap-2 py-1">
          <div
            class="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs text-white font-medium"
          >
            {{ member.name.charAt(0).toUpperCase() }}
          </div>
          <div>
            <div class="text-sm font-medium">{{ member.name }}</div>
            <div class="text-xs text-gray-500">{{ member.email }}</div>
          </div>
        </div>
      </ng-template>
    </p-autoComplete>
  `,
})
export class MemberPickerComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private searchSubject = new Subject<string>();

  workspaceId = input.required<string>();
  excludeUserIds = input<string[]>([]);
  label = input('Search members');
  placeholder = input('Type a name or email...');
  memberSelected = output<MemberSearchResult>();

  results = signal<MemberSearchResult[]>([]);
  searching = signal(false);
  searchQuery: string | MemberSearchResult = '';

  ngOnInit(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        switchMap((query) => {
          if (query.length < 2) {
            return of([]);
          }
          this.searching.set(true);
          return this.workspaceService.searchMembers(this.workspaceId(), query);
        }),
      )
      .subscribe((members) => {
        const excluded = new Set(this.excludeUserIds());
        this.results.set(members.filter((m) => !excluded.has(m.id)));
        this.searching.set(false);
      });
  }

  onSearch(event: { query: string }): void {
    this.searchSubject.next(event.query);
  }

  onSelected(event: { value: MemberSearchResult }): void {
    this.memberSelected.emit(event.value);
    this.searchQuery = '';
    this.results.set([]);
  }
}
