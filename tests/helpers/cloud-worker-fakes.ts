type SqlValue = string | number | null;

class FakePreparedStatement {
  private readonly db: FakeMetadataDb;
  private readonly query: string;
  private values: SqlValue[] = [];

  constructor(db: FakeMetadataDb, query: string) {
    this.db = db;
    this.query = query;
  }

  bind(...values: SqlValue[]): FakePreparedStatement {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return {
      results: this.db.all(this.query, this.values) as T[]
    };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.db.first(this.query, this.values) as T | null;
  }

  async run(): Promise<void> {
    this.db.run(this.query, this.values);
  }
}

class FakeMetadataDb {
  readonly jobs: Record<string, unknown>[];
  readonly materials: Record<string, unknown>[];
  readonly presentations: Record<string, unknown>[];
  readonly providerConfigs: Record<string, unknown>[];
  readonly slides: Record<string, unknown>[];
  readonly sources: Record<string, unknown>[];
  readonly workspaces: Record<string, unknown>[];

  constructor(
    workspaces: Record<string, unknown>[] = [],
    presentations: Record<string, unknown>[] = [],
    slides: Record<string, unknown>[] = [],
    jobs: Record<string, unknown>[] = [],
    sources: Record<string, unknown>[] = [],
    materials: Record<string, unknown>[] = [],
    providerConfigs: Record<string, unknown>[] = []
  ) {
    this.jobs = jobs;
    this.materials = materials;
    this.presentations = presentations;
    this.providerConfigs = providerConfigs;
    this.slides = slides;
    this.sources = sources;
    this.workspaces = workspaces;
  }

  // fallow-ignore-next-line unused-class-member
  prepare(query: string): FakePreparedStatement {
    return new FakePreparedStatement(this, query);
  }

  all(query: string, values: SqlValue[]): Record<string, unknown>[] {
    if (query.includes("FROM workspaces")) {
      return this.workspaces;
    }

    if (query.includes("FROM presentations")) {
      return this.presentations.filter((presentation) => presentation.workspace_id === values[0]);
    }

    if (query.includes("FROM slides")) {
      return this.slides.filter((slide) => slide.workspace_id === values[0] && slide.presentation_id === values[1]);
    }

    if (query.includes("FROM jobs")) {
      return this.jobs.filter((job) => job.workspace_id === values[0] && job.presentation_id === values[1]);
    }

    if (query.includes("FROM sources")) {
      return this.sources.filter((source) => source.workspace_id === values[0] && source.presentation_id === values[1]);
    }

    if (query.includes("FROM materials")) {
      return this.materials.filter((material) => material.workspace_id === values[0] && material.presentation_id === values[1]);
    }

    throw new Error(`Unsupported fake all query: ${query}`);
  }

  first(query: string, values: SqlValue[]): Record<string, unknown> | null {
    if (query.includes("FROM presentations")) {
      return this.presentations.find((presentation) => presentation.workspace_id === values[0] && presentation.id === values[1]) || null;
    }

    if (query.includes("FROM provider_configs")) {
      return this.providerConfigs.find((providerConfig) => providerConfig.workspace_id === values[0]) || null;
    }

    if (query.includes("FROM jobs")) {
      return this.jobs.find((job) => job.workspace_id === values[0] && job.presentation_id === values[1] && job.id === values[2]) || null;
    }

    if (query.includes("FROM slides")) {
      return this.slides.find((slide) => slide.workspace_id === values[0] && slide.presentation_id === values[1] && slide.id === values[2]) || null;
    }

    if (query.includes("FROM sources")) {
      return this.sources.find((source) => source.workspace_id === values[0] && source.presentation_id === values[1] && source.id === values[2]) || null;
    }

    if (query.includes("FROM materials")) {
      return this.materials.find((material) => material.workspace_id === values[0] && material.presentation_id === values[1] && material.id === values[2]) || null;
    }

    throw new Error(`Unsupported fake first query: ${query}`);
  }

  run(query: string, values: SqlValue[]): void {
    if (query.includes("INTO workspaces")) {
      this.workspaces.push({ id: values[0], name: values[1], created_at: values[2], updated_at: values[3] });
      return;
    }

    if (query.includes("INTO presentations")) {
      this.presentations.push({
        id: values[0],
        workspace_id: values[1],
        title: values[2],
        latest_version: values[3],
        r2_prefix: values[4],
        created_at: values[5],
        updated_at: values[6]
      });
      return;
    }

    if (query.includes("INTO slides")) {
      const nextSlide = {
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        order_index: values[3],
        title: values[4],
        version: values[5],
        spec_object_key: values[6]
      };
      const existingIndex = this.slides.findIndex((slide) => slide.workspace_id === values[1] && slide.presentation_id === values[2] && slide.id === values[0]);
      if (existingIndex >= 0) {
        this.slides[existingIndex] = nextSlide;
      } else {
        this.slides.push(nextSlide);
      }
      return;
    }

    if (query.includes("INTO jobs")) {
      this.jobs.push({
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        kind: values[3],
        status: values[4],
        provider: values[5],
        model: values[6],
        provider_snapshot_json: values[7],
        base_version: values[8],
        grounding_summary_json: values[9],
        diagnostics_json: values[10],
        result_object_key: values[11],
        failure_detail: values[12],
        created_at: values[13],
        updated_at: values[14]
      });
      return;
    }

    if (query.includes("INTO provider_configs")) {
      const nextProviderConfig = {
        workspace_id: values[0],
        provider: values[1],
        model: values[2],
        credential_ref: values[3],
        allowed_data_classes_json: values[4],
        enabled_workflows_json: values[5],
        created_by: values[6],
        created_at: values[7],
        updated_at: values[8]
      };
      const existingIndex = this.providerConfigs.findIndex((providerConfig) => providerConfig.workspace_id === values[0]);
      if (existingIndex >= 0) {
        this.providerConfigs[existingIndex] = nextProviderConfig;
      } else {
        this.providerConfigs.push(nextProviderConfig);
      }
      return;
    }

    if (query.includes("UPDATE jobs")) {
      const existing = this.jobs.find((job) => job.workspace_id === values[5] && job.presentation_id === values[6] && job.id === values[7]);
      if (existing) {
        existing.status = values[0];
        existing.diagnostics_json = values[1];
        existing.result_object_key = values[2];
        existing.failure_detail = values[3];
        existing.updated_at = values[4];
      }
      return;
    }

    if (query.includes("INTO sources")) {
      this.sources.push({
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        title: values[3],
        source_type: values[4],
        url: values[5],
        object_key: values[6],
        created_at: values[7],
        updated_at: values[8]
      });
      return;
    }

    if (query.includes("INTO materials")) {
      this.materials.push({
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        title: values[3],
        media_type: values[4],
        file_name: values[5],
        object_key: values[6],
        created_at: values[7],
        updated_at: values[8]
      });
      return;
    }

    throw new Error(`Unsupported fake run query: ${query}`);
  }
}

class FakeObjectBucket {
  readonly objects = new Map<string, string>();

  // fallow-ignore-next-line unused-class-member
  async get(key: string): Promise<{ text(): Promise<string> } | null> {
    const value = this.objects.get(key);
    return value === undefined ? null : { async text() { return value; } };
  }

  // fallow-ignore-next-line unused-class-member
  async put(key: string, value: string): Promise<void> {
    this.objects.set(key, value);
  }
}

class FakeQueue {
  readonly messages: unknown[] = [];

  // fallow-ignore-next-line unused-class-member
  async send(message: unknown): Promise<void> {
    this.messages.push(message);
  }
}

class FakeWorkersAi {
  readonly calls: Array<{ input: unknown; model: string }> = [];
  response: unknown;

  constructor(title = "AI Candidate", outline = ["Context", "Proposal"]) {
    this.response = {
      response: JSON.stringify({
        candidate: {
          outline,
          title
        }
      })
    };
  }

  // fallow-ignore-next-line unused-class-member
  async run(model: string, input: unknown): Promise<unknown> {
    this.calls.push({ input, model });
    return this.response;
  }
}

export {
  FakeMetadataDb,
  FakeObjectBucket,
  FakeQueue,
  FakeWorkersAi
};
export type { SqlValue };
