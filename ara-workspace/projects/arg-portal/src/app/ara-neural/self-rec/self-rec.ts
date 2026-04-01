import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { araGridTheme } from '../../ara/shared/ara-grid-theme';
import { PageHeaderComponent, Breadcrumb } from '../../ara/shared/page-header/page-header';
import { SelfRecUploadService, UploadResponse } from './self-rec-upload.service';
import { SelfRecMappingService, MappingRow, SaveMappingResponse } from './self-rec-mapping.service';
import { SelfRecPassesService, PassConfig, PassKey, MatchType, SavePassesResponse } from './self-rec-passes.service';
import { SelfRecViewService, ViewConfig, ViewColumn, SummaryCard, CategoryConfig, SortConfig, GroupConfig, SaveViewResponse } from './self-rec-view.service';
import { SelfRecRunService, RunRequest, RunResponse, RunSummary } from './self-rec-run.service';
import { SelfRecResultsService, ResultRow, AnalyzerReport, ResultsResponse } from './self-rec-results.service';
import { SelfRecPythonRunService } from './self-rec-python-run.service';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface RecStep {
  id: number;
  label: string;
  description: string;
  detail: string;
}

export interface UploadedFile {
  name: string;
  size: number;
  uploadId?: string;
  columns: string[];
  preview: string[][];
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

export interface FieldGroup {
  type: string;
  label: string;
  fields: string[];
}

@Component({
  selector: 'ara-self-rec',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, PageHeaderComponent],
  templateUrl: './self-rec.html',
  styleUrl: './self-rec.scss',
})
export class SelfRecComponent {

  private readonly uploadService  = inject(SelfRecUploadService);
  private readonly mappingService = inject(SelfRecMappingService);
  private readonly passesService  = inject(SelfRecPassesService);
  private readonly viewService    = inject(SelfRecViewService);
  private readonly runService       = inject(SelfRecRunService);
  private readonly resultsService   = inject(SelfRecResultsService);
  private readonly pythonRunService = inject(SelfRecPythonRunService);

  readonly theme = araGridTheme;

  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA Neural', route: '/ara-neural/schema' },
    { label: 'ARA Self Rec' },
  ];

  readonly matchTypes = [
    { value: 'exact'     as const, label: 'Exact' },
    { value: 'tolerance' as const, label: 'Tolerance' },
    { value: 'manual'    as const, label: 'Manual' },
  ];

  readonly steps: RecStep[] = [
    {
      id: 0,
      label: 'Upload Files',
      description: 'Upload your source and target reconciliation files.',
      detail: 'Upload one CSV for Source A and one for Source B. Both files are required before you can continue. Supported format: CSV with a header row. Files are parsed server-side and a preview of the first rows will appear once uploaded.'
    },
    {
      id: 1,
      label: 'Create Map',
      description: 'Map columns between your source and target files.',
      detail: 'Each row shows a column from Source A. Select the matching column from Source B. Suggestions are generated automatically — review them and adjust where needed. At least one pair must be mapped, then click Save Map to continue.'
    },
    {
      id: 2,
      label: 'Create Pass',
      description: 'Configure matching rules for each reconciliation pass.',
      detail: 'A pass defines how records are paired. Add one or more key fields to identify matching records. You can create multiple passes — the engine will try each in order and record which pass produced each match. Click Save Passes when done.'
    },
    {
      id: 3,
      label: 'Create View',
      description: 'Configure how results will be displayed.',
      detail: 'Choose which columns appear in your results, set a default sort order, and enable grouping. Summary Cards and Result Sections control what appears at the top of the results page. Click Save View to proceed.'
    },
    {
      id: 4,
      label: 'Run Recon',
      description: 'Review your configuration and run the reconciliation.',
      detail: 'Check the summary above to confirm your uploads, mapping, passes, and view are correct. Choose Preview to test without committing, or Execute to produce the final output. Results appear immediately below the run button.'
    },
  ];

  readonly activeStep = signal(0);
  readonly isFirst    = computed(() => this.activeStep() === 0);
  readonly isLast     = computed(() => this.activeStep() === this.steps.length - 1);

  /** Highest step the user has legitimately unlocked */
  readonly maxUnlocked = computed(() => {
    if (this.sourceA()?.status !== 'ready' || this.sourceB()?.status !== 'ready') return 0;
    if (!this.mappingRows().some(r => r.sourceBField !== null) || this.mappingSaveStatus() !== 'saved') return 1;
    if (this.passes().length === 0 || this.passSaveStatus() !== 'saved') return 2;
    if (this.viewSaveStatus() !== 'saved') return 3;
    return 4;
  });

  canGoTo(index: number): boolean {
    return index <= this.maxUnlocked();
  }

  // ── Upload state ────────────────────────────────────────────────────────────
  readonly sourceA  = signal<UploadedFile | null>(null);
  readonly sourceB  = signal<UploadedFile | null>(null);
  readonly dragOver = signal<'A' | 'B' | null>(null);

  readonly canNext = computed(() => {
    if (this.isLast()) return false;
    if (this.activeStep() === 0) {
      return this.sourceA()?.status === 'ready' && this.sourceB()?.status === 'ready';
    }
    if (this.activeStep() === 1) {
      return this.mappingRows().some(r => r.sourceBField !== null) &&
             this.mappingSaveStatus() === 'saved';
    }
    if (this.activeStep() === 2) {
      return this.passes().length > 0 && this.passSaveStatus() === 'saved';
    }
    if (this.activeStep() === 3) {
      return this.viewSaveStatus() === 'saved';
    }
    return true;
  });

  /** Message shown below the Next button when it is disabled */
  readonly nextHint = computed((): string | null => {
    if (!this.isLast() && !this.canNext()) {
      if (this.activeStep() === 0) return 'Upload both Source A and Source B files to continue.';
      if (this.activeStep() === 1) {
        if (!this.mappingRows().some(r => r.sourceBField !== null)) return 'Map at least one field pair to continue.';
        return 'Save your mapping to continue.';
      }
      if (this.activeStep() === 2) {
        if (this.passes().length === 0) return 'Add at least one pass to continue.';
        return 'Save your passes to continue.';
      }
      if (this.activeStep() === 3) return 'Save your view to continue.';
    }
    return null;
  });

  // ── Step navigation ─────────────────────────────────────────────────────────
  goTo(index: number): void {
    // Prevent jumping ahead of unlocked steps
    if (this.canGoTo(index)) this.activeStep.set(index);
  }
  next(): void  {
    if (this.canNext()) {
      this.activeStep.update(s => s + 1);
      if (this.activeStep() === 1) this.loadMappingSuggestions();
      if (this.activeStep() === 2) this.initPasses();
      if (this.activeStep() === 3) this.initView();
      if (this.activeStep() === 4) this.initRun();
    }
  }
  back(): void  { if (!this.isFirst()) this.activeStep.update(s => s - 1); }

  // ── File upload helpers ─────────────────────────────────────────────────────
  onFileInputChange(event: Event, source: 'A' | 'B'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadFile(file, source);
    // reset input so the same file can be re-selected
    (event.target as HTMLInputElement).value = '';
  }

  onDrop(event: DragEvent, source: 'A' | 'B'): void {
    event.preventDefault();
    this.dragOver.set(null);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadFile(file, source);
  }

  onDragOver(event: DragEvent, source: 'A' | 'B'): void {
    event.preventDefault();
    this.dragOver.set(source);
  }

  onDragLeave(): void { this.dragOver.set(null); }

  removeFile(source: 'A' | 'B'): void {
    if (source === 'A') this.sourceA.set(null);
    else this.sourceB.set(null);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  previewColumns(file: UploadedFile): string[] {
    return file.columns.slice(0, 6);
  }

  private uploadFile(file: File, source: 'A' | 'B'): void {
    const slot = source === 'A' ? this.sourceA : this.sourceB;
    slot.set({ name: file.name, size: file.size, columns: [], preview: [], status: 'uploading' });

    this.uploadService.upload(file, source).subscribe({
      next: (res: UploadResponse) =>
        slot.set({ name: res.name, size: res.size, uploadId: res.uploadId, columns: res.columns, preview: res.preview, status: 'ready' }),
      error: (err: Error) =>
        slot.set({ name: file.name, size: file.size, columns: [], preview: [], status: 'error', error: err.message }),
    });
  }

  // ── Mapping state ───────────────────────────────────────────────────────────
  readonly mappingRows       = signal<MappingRow[]>([]);
  readonly mappingLoading    = signal(false);
  readonly mappingError      = signal<string | null>(null);
  readonly mappingSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly mappingId         = signal<string | null>(null);

  get columnsB(): string[] {
    return this.sourceB()?.columns ?? [];
  }

  loadMappingSuggestions(): void {
    const a = this.sourceA();
    const b = this.sourceB();
    if (!a || !b) return;

    this.mappingRows.set([]);
    this.mappingLoading.set(true);
    this.mappingError.set(null);
    this.mappingSaveStatus.set('idle');
    this.mappingId.set(null);

    this.mappingService.suggest(a.columns, b.columns).subscribe({
      next: res => {
        this.mappingRows.set(res.mappings);
        this.mappingLoading.set(false);
      },
      error: (err: Error) => {
        this.mappingError.set(err.message);
        this.mappingLoading.set(false);
      },
    });
  }

  updateMappingTarget(index: number, field: string | null): void {
    this.mappingRows.update(rows => {
      const updated = [...rows];
      updated[index] = { ...updated[index], sourceBField: field || null };
      return updated;
    });
    // Any change invalidates the saved state
    if (this.mappingSaveStatus() === 'saved') this.mappingSaveStatus.set('idle');
  }

  saveMapping(): void {
    this.mappingSaveStatus.set('saving');
    this.mappingService.saveMapping(this.mappingRows()).subscribe({
      next: (res: SaveMappingResponse) => {
        this.mappingSaveStatus.set('saved');
        this.mappingId.set(res.mappingId);
      },
      error: () => this.mappingSaveStatus.set('error'),
    });
  }

  // ── Pass state ──────────────────────────────────────────────────────────────
  readonly passes         = signal<PassConfig[]>([]);
  readonly passSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly passSetId      = signal<string | null>(null);

  // ── Pass workbench state ────────────────────────────────────────────────────
  readonly activePassId     = signal<string | null>(null);
  readonly fieldSearchA     = signal('');
  readonly fieldSearchB     = signal('');
  readonly stagedFieldA     = signal<string | null>(null);
  readonly showUnmappedOnly = signal(false);

  readonly activePass = computed(() =>
    this.passes().find(p => p.id === this.activePassId()) ?? null
  );

  readonly activePassKeys = computed(() => this.activePass()?.keys ?? []);

  readonly groupedFieldsA = computed((): FieldGroup[] => {
    const search = this.fieldSearchA().toLowerCase().trim();
    const used   = new Set(this.activePassKeys().map(k => k.sourceAField));
    const cols   = this.mappedFields.map(f => f.sourceAField);
    const filtered = cols.filter(f =>
      (!search || f.toLowerCase().includes(search)) &&
      (!this.showUnmappedOnly() || !used.has(f))
    );
    return this.groupFields(filtered);
  });

  readonly groupedFieldsB = computed((): FieldGroup[] => {
    const search = this.fieldSearchB().toLowerCase().trim();
    const used   = new Set(this.activePassKeys().map(k => k.sourceBField).filter((b): b is string => !!b));
    const cols   = this.mappedFields.map(f => f.sourceBField);
    const filtered = cols.filter(f =>
      (!search || f.toLowerCase().includes(search)) &&
      (!this.showUnmappedOnly() || !used.has(f))
    );
    return this.groupFields(filtered);
  });

  /** Available mapped fields (from completed mapping step) */
  get mappedFields(): PassKey[] {
    return this.mappingRows()
      .filter(r => r.sourceBField !== null)
      .map(r => ({ sourceAField: r.sourceAField, sourceBField: r.sourceBField! }));
  }

  initPasses(): void {
    if (this.passes().length > 0) {
      if (!this.activePassId()) this.activePassId.set(this.passes()[0].id);
      return;
    }
    const mapped = this.mappedFields;
    if (mapped.length === 0) return;
    const seed: PassConfig = {
      id: this.newPassId(),
      name: 'Pass 1 — Exact Match',
      order: 1,
      enabled: true,
      matchType: 'exact',
      keys: mapped.slice(0, Math.min(3, mapped.length)),
      description: '',
    };
    this.passes.set([seed]);
    this.activePassId.set(seed.id);
  }

  addPass(): void {
    const n = this.passes().length + 1;
    const p: PassConfig = {
      id: this.newPassId(),
      name: `Pass ${n}`,
      order: n,
      enabled: true,
      matchType: 'exact',
      keys: [],
      description: '',
    };
    this.passes.update(list => [...list, p]);
    this.activePassId.set(p.id);
    this.fieldSearchA.set('');
    this.fieldSearchB.set('');
    this.stagedFieldA.set(null);
    this.passSaveStatus.set('idle');
  }

  removePass(id: string): void {
    const wasActive = this.activePassId() === id;
    this.passes.update(list =>
      list.filter(p => p.id !== id).map((p, i) => ({ ...p, order: i + 1 }))
    );
    if (wasActive) {
      const remaining = this.passes();
      this.activePassId.set(remaining.length > 0 ? remaining[0].id : null);
    }
    this.passSaveStatus.set('idle');
  }

  movePass(id: string, dir: -1 | 1): void {
    this.passes.update(list => {
      const idx = list.findIndex(p => p.id === id);
      const dst = idx + dir;
      if (dst < 0 || dst >= list.length) return list;
      const copy = [...list];
      [copy[idx], copy[dst]] = [copy[dst], copy[idx]];
      return copy.map((p, i) => ({ ...p, order: i + 1 }));
    });
    this.passSaveStatus.set('idle');
  }

  updatePass(id: string, patch: Partial<PassConfig>): void {
    this.passes.update(list =>
      list.map(p => p.id === id ? { ...p, ...patch } : p)
    );
    this.passSaveStatus.set('idle');
  }

  setActivePass(id: string): void {
    this.activePassId.set(id);
    this.fieldSearchA.set('');
    this.fieldSearchB.set('');
    this.stagedFieldA.set(null);
  }

  selectFieldA(field: string): void {
    this.stagedFieldA.update(cur => cur === field ? null : field);
  }

  selectFieldB(bField: string): void {
    const aField = this.stagedFieldA();
    const passId = this.activePassId();
    if (!passId) return;
    if (aField) {
      const existingIdx = this.activePass()?.keys.findIndex(k => k.sourceAField === aField) ?? -1;
      if (existingIdx >= 0) {
        this.updateRuleField(passId, existingIdx, 'B', bField);
      } else {
        this.addRule(passId, aField, bField);
      }
      this.stagedFieldA.set(null);
    } else {
      const blankIdx = this.activePass()?.keys.findIndex(k => !k.sourceBField) ?? -1;
      if (blankIdx >= 0) this.updateRuleField(passId, blankIdx, 'B', bField);
    }
    this.passSaveStatus.set('idle');
  }

  addRule(passId: string, aField = '', bField = ''): void {
    this.passes.update(list => list.map(p =>
      p.id !== passId ? p : { ...p, keys: [...p.keys, { sourceAField: aField, sourceBField: bField }] }
    ));
    this.passSaveStatus.set('idle');
  }

  removeRule(passId: string, idx: number): void {
    this.passes.update(list => list.map(p =>
      p.id !== passId ? p : { ...p, keys: p.keys.filter((_, i) => i !== idx) }
    ));
    this.passSaveStatus.set('idle');
  }

  moveRule(passId: string, idx: number, dir: -1 | 1): void {
    this.passes.update(list => list.map(p => {
      if (p.id !== passId) return p;
      const keys = [...p.keys];
      const dst = idx + dir;
      if (dst < 0 || dst >= keys.length) return p;
      [keys[idx], keys[dst]] = [keys[dst], keys[idx]];
      return { ...p, keys };
    }));
    this.passSaveStatus.set('idle');
  }

  updateRuleField(passId: string, idx: number, side: 'A' | 'B', value: string): void {
    this.passes.update(list => list.map(p => {
      if (p.id !== passId) return p;
      const keys = p.keys.map((k, i) => i === idx
        ? side === 'A' ? { ...k, sourceAField: value } : { ...k, sourceBField: value }
        : k
      );
      return { ...p, keys };
    }));
    this.passSaveStatus.set('idle');
  }

  updateRuleOperator(passId: string, idx: number, operator: MatchType): void {
    this.passes.update(list => list.map(p =>
      p.id !== passId ? p : {
        ...p,
        keys: p.keys.map((k, i) => i === idx ? { ...k, operator } : k)
      }
    ));
    this.passSaveStatus.set('idle');
  }

  suggestRules(): void {
    const pass = this.activePass();
    if (!pass || pass.keys.length > 0) return;
    this.passes.update(list => list.map(p =>
      p.id !== pass.id ? p : { ...p, keys: [...this.mappedFields] }
    ));
    this.passSaveStatus.set('idle');
  }

  isFieldUsedA(field: string): boolean {
    return this.activePassKeys().some(k => k.sourceAField === field);
  }

  isFieldUsedB(field: string): boolean {
    return this.activePassKeys().some(k => k.sourceBField === field);
  }

  classifyField(name: string): string {
    const n = name.toLowerCase();
    if (/id$|ref$|code$|key$|num(ber)?$/.test(n)) return 'key';
    if (/amount|qty|quantity|price|value|notional|net|gross|fee|unit/.test(n)) return 'amount';
    if (/date|dt$|time$|day$/.test(n)) return 'date';
    if (/status|state|flag|type$|side$|direction|ccy$|currency/.test(n)) return 'status';
    return 'text';
  }

  fieldTypeInitial(name: string): string {
    const map: Record<string, string> = { key: 'K', amount: '$', date: 'D', status: 'S', text: 'T' };
    return map[this.classifyField(name)] ?? 'T';
  }

  private groupFields(inputs: string[]): FieldGroup[] {
    const buckets: Record<string, string[]> = { key: [], amount: [], date: [], status: [], text: [] };
    for (const f of inputs) buckets[this.classifyField(f)].push(f);
    const labels: Record<string, string> = { key: 'Keys', amount: 'Amounts', date: 'Dates', status: 'Status', text: 'Text' };
    return Object.entries(buckets)
      .filter(([, fs]) => fs.length > 0)
      .map(([type, fs]) => ({ type, label: labels[type], fields: fs }));
  }

  savePasses(): void {
    this.passSaveStatus.set('saving');
    this.passesService.savePasses(this.passes()).subscribe({
      next: (res: SavePassesResponse) => {
        this.passSaveStatus.set('saved');
        this.passSetId.set(res.passSetId);
      },
      error: () => this.passSaveStatus.set('error'),
    });
  }

  private passCounter = 0;
  private newPassId(): string {
    return `pass-${++this.passCounter}`;
  }

  // ── View state ──────────────────────────────────────────────────────────────
  readonly viewColumns    = signal<ViewColumn[]>([]);
  readonly viewCategories = signal<CategoryConfig[]>([
    { category: 'matched',    visible: true,  label: 'Matched Records' },
    { category: 'unmatched',  visible: true,  label: 'Unmatched Records' },
    { category: 'breaks',     visible: true,  label: 'Breaks / Differences' },
    { category: 'exceptions', visible: false, label: 'Exceptions' },
  ]);
  readonly viewSummaryCards = signal<SummaryCard[]>([
    { id: 'match_rate',  label: 'Match Rate',       visible: true  },
    { id: 'matched',     label: 'Matched',          visible: true  },
    { id: 'unmatched',   label: 'Unmatched',        visible: true  },
    { id: 'breaks',      label: 'Breaks',           visible: true  },
    { id: 'exceptions',  label: 'Exceptions',       visible: false },
  ]);
  readonly viewSort       = signal<SortConfig | null>(null);
  readonly viewGroupBy    = signal<GroupConfig | null>(null);
  readonly viewName       = signal('Default View');
  readonly viewSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly viewId         = signal<string | null>(null);

  readonly viewColumnSearch = signal('');

  readonly filteredViewColumns = computed(() => {
    const q = this.viewColumnSearch().toLowerCase().trim();
    if (!q) return this.viewColumns();
    return this.viewColumns().filter(c => c.field.toLowerCase().includes(q) || (c.label ?? '').toLowerCase().includes(q));
  });

  readonly visibleColumnCount = computed(() => this.viewColumns().filter(c => c.visible).length);

  initView(): void {
    // Build column list from mapped pairs (both A and B fields)
    const mapped = this.mappedFields;
    if (mapped.length === 0) return;
    if (this.viewColumns().length > 0) return; // already initialised

    const cols: ViewColumn[] = [
      // Key-type fields default visible; others visible too — user can hide
      ...mapped.map(m => ({
        field: m.sourceAField,
        source: 'A' as const,
        visible: true,
        label: m.sourceAField,
      })),
      ...mapped.map(m => ({
        field: m.sourceBField,
        source: 'B' as const,
        visible: false, // B-side columns hidden by default (show diff only)
        label: m.sourceBField,
      })),
      // Always include a computed break column
      { field: '__break_amount', source: 'both' as const, visible: true, label: 'Break Amount' },
      { field: '__break_pct',    source: 'both' as const, visible: false, label: 'Break %' },
      { field: '__match_pass',   source: 'both' as const, visible: true, label: 'Matched by Pass' },
      { field: '__reason',       source: 'both' as const, visible: true, label: 'Reason / Note' },
    ];

    this.viewColumns.set(cols);

    // Default sort: first key-type A field
    const firstKey = mapped.find(m => this.classifyField(m.sourceAField) === 'key');
    if (firstKey) {
      this.viewSort.set({ field: firstKey.sourceAField, direction: 'asc' });
    }
  }

  toggleColumnVisible(field: string): void {
    this.viewColumns.update(cols =>
      cols.map(c => c.field === field ? { ...c, visible: !c.visible } : c)
    );
    this.viewSaveStatus.set('idle');
  }

  setAllColumnsVisible(visible: boolean): void {
    this.viewColumns.update(cols => cols.map(c => ({ ...c, visible })));
    this.viewSaveStatus.set('idle');
  }

  updateColumnLabel(field: string, label: string): void {
    this.viewColumns.update(cols =>
      cols.map(c => c.field === field ? { ...c, label } : c)
    );
    this.viewSaveStatus.set('idle');
  }

  toggleCategoryVisible(category: string): void {
    this.viewCategories.update(cats =>
      cats.map(c => c.category === category ? { ...c, visible: !c.visible } : c)
    );
    this.viewSaveStatus.set('idle');
  }

  toggleSummaryCard(id: string): void {
    this.viewSummaryCards.update(cards =>
      cards.map(c => c.id === id ? { ...c, visible: !c.visible } : c)
    );
    this.viewSaveStatus.set('idle');
  }

  setViewSort(field: string, direction: 'asc' | 'desc'): void {
    this.viewSort.set(field ? { field, direction } : null);
    this.viewSaveStatus.set('idle');
  }

  setViewGroupBy(field: string): void {
    this.viewGroupBy.set(field ? { field, showSubtotals: true } : null);
    this.viewSaveStatus.set('idle');
  }

  toggleGroupSubtotals(): void {
    this.viewGroupBy.update(g => g ? { ...g, showSubtotals: !g.showSubtotals } : g);
    this.viewSaveStatus.set('idle');
  }

  saveView(): void {
    const config: ViewConfig = {
      name: this.viewName(),
      columns: this.viewColumns(),
      sort: this.viewSort() ?? undefined,
      groupBy: this.viewGroupBy() ?? undefined,
      summaryCards: this.viewSummaryCards(),
      categories: this.viewCategories(),
    };
    this.viewSaveStatus.set('saving');
    this.viewService.saveView(config).subscribe({
      next: (res: SaveViewResponse) => {
        this.viewSaveStatus.set('saved');
        this.viewId.set(res.viewId);
      },
      error: () => this.viewSaveStatus.set('error'),
    });
  }

  // ── Run Recon state ─────────────────────────────────────────────────────────
  readonly runMode      = signal<'preview' | 'execute'>('preview');
  readonly submittedBy  = signal('');
  readonly runStatus    = signal<'idle' | 'running' | 'complete' | 'error'>('idle');
  readonly runId        = signal<string | null>(null);
  readonly runSummary   = signal<RunSummary | null>(null);
  readonly runMessage   = signal<string | null>(null);
  readonly runError     = signal<string | null>(null);

  initRun(): void {
    this.runStatus.set('idle');
    this.runId.set(null);
    this.runSummary.set(null);
    this.runMessage.set(null);
    this.runError.set(null);
    this.resultRows.set([]);
    this.analyzerData.set(null);
    this.resultsLoading.set(false);
    this.resultsError.set(null);
    this.sampleNote.set(null);
    this.resultTab.set('matched');
  }

  runRecon(): void {
    const a = this.sourceA();
    const b = this.sourceB();
    if (!a || !b) return;

    this.runStatus.set('running');
    this.runError.set(null);

    this.pythonRunService.run({
      sourceAName:     a.name,
      sourceAUploadId: a.uploadId,
      sourceAColumns:  a.columns,
      sourceBName:     b.name,
      sourceBUploadId: b.uploadId,
      sourceBColumns:  b.columns,
      mappingRows:     this.mappingRows(),
      passes:          this.passes(),
      viewName:        this.viewName(),
      viewColumns:     this.viewColumns(),
      viewSort:        this.viewSort(),
      viewGroupBy:     this.viewGroupBy(),
      viewSummaryCards: this.viewSummaryCards(),
      viewCategories:  this.viewCategories(),
      submittedBy:     this.submittedBy() || 'anonymous',
      runMode:         this.runMode(),
    }).subscribe({
      next: res => {
        this.runId.set(res.runId);
        this.runSummary.set(res.summary);
        this.runMessage.set(res.message ?? null);
        this.runStatus.set('complete');
        // Python engine returns rows inline — apply directly without a second HTTP call
        this.resultRows.set(res.rows);
        this.analyzerData.set(res.analyzerReport);
        this.sampleNote.set(null);
        this.resultTab.set('matched');
      },
      error: () => {
        this.runStatus.set('error');
        this.runError.set('Reconciliation failed. Please check your configuration and try again.');
      },
    });
  }

  // ── Results state ────────────────────────────────────────────────────────────
  readonly resultTab      = signal<'matched' | 'breaks' | 'exceptions' | 'analyzer'>('matched');
  readonly resultRows     = signal<ResultRow[]>([]);
  readonly analyzerData   = signal<AnalyzerReport | null>(null);
  readonly resultsLoading = signal(false);
  readonly resultsError   = signal<string | null>(null);
  readonly sampleNote     = signal<string | null>(null);

  readonly matchedRows   = computed(() => this.resultRows().filter(r => r.status === 'matched'));
  readonly breakRows     = computed(() => this.resultRows().filter(r => r.status === 'break' || r.status === 'unmatched'));
  readonly exceptionRows = computed(() => this.resultRows().filter(r => r.status === 'exception'));

  // ColDefs for result grids
  readonly resultColDefs: ColDef<ResultRow>[] = [
    {
      field: 'status', headerName: 'Status', width: 115, pinned: 'left',
      cellRenderer: (p: any) => this.resultStatusHtml(p.value),
    },
    { field: 'keyRef',        headerName: 'Key / Ref',      width: 140, pinned: 'left' },
    { field: 'sourceAValue',  headerName: 'Source A Value', flex: 1, minWidth: 120 },
    { field: 'sourceBValue',  headerName: 'Source B Value', flex: 1, minWidth: 120 },
    { field: 'difference',    headerName: 'Difference',     width: 110 },
    { field: 'breakReason',   headerName: 'Reason',         flex: 1, minWidth: 150 },
    { field: 'matchedByPass', headerName: 'Matched Pass',   width: 130 },
    { field: 'comments',      headerName: 'Comments',       flex: 2, minWidth: 150 },
  ];

  readonly resultDefaultColDef: ColDef = {
    sortable: true, resizable: true, filter: true,
  };

  private resultStatusHtml(status: string): string {
    const cfg: Record<string, [string, string, string]> = {
      matched:   ['Matched',   '#4ade80', 'rgba(74,222,128,.12)'],
      break:     ['Break',     '#f87171', 'rgba(248,113,113,.12)'],
      exception: ['Exception', '#fbbf24', 'rgba(251,191,36,.12)'],
      unmatched: ['Unmatched', '#a78bfa', 'rgba(167,139,250,.12)'],
    };
    const [label, color, bg] = cfg[status] ?? [status, '#9ca3af', 'rgba(156,163,175,.1)'];
    return `<span style="display:inline-flex;align-items:center;padding:2px 9px;border-radius:10px;font-size:.68rem;font-weight:600;color:${color};background:${bg}">${label}</span>`;
  }

  fetchResults(): void {
    const id = this.runId();
    if (!id) return;
    this.resultsLoading.set(true);
    this.resultsError.set(null);
    this.resultRows.set([]);
    this.analyzerData.set(null);
    this.sampleNote.set(null);
    this.resultTab.set('matched');
    this.resultsService.getResults(id).subscribe({
      next: (res: ResultsResponse) => {
        this.resultRows.set(res.rows);
        this.analyzerData.set(res.analyzerReport);
        this.sampleNote.set(res.sampleNote ?? null);
        this.resultsLoading.set(false);
      },
      error: () => {
        this.resultsError.set('Failed to load results. Please retry or re-run the reconciliation.');
        this.resultsLoading.set(false);
      },
    });
  }
}
