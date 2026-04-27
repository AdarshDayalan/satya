# Truth Graph MVP

> I drop anything in, and my worldview-map organizes itself.

A responsive web app where users drop text/links/notes/voice, AI extracts meaning nodes, connects them in a graph, and suggests emergent folders/themes as views over clusters.

---

## Rules

- Graph-first, folders second
- Folders are views over clusters, not hardcoded categories
- Every input becomes raw data first, then AI extracts meaning
- User should never manually organize unless they want to
- Mobile and laptop must both feel good
- Keep MVP simple, do not overbuild
- Raw input must always be saved before AI processing

---

## Tech Stack

| Layer          | Choice                          |
| -------------- | ------------------------------- |
| Frontend       | Next.js App Router, TypeScript  |
| Styling        | Tailwind CSS                    |
| Auth           | Supabase Auth                   |
| Database       | Supabase Postgres               |
| Vector Search  | pgvector in Supabase            |
| AI             | Gemini API (2.0 Flash + text-embedding-004) |
| Hosting        | Vercel                          |
| Storage        | Supabase Storage (later)        |
| Mobile         | Responsive PWA                  |

---

## Data Model

### `inputs` — raw things the user drops in

| Column       | Type         | Default              |
| ------------ | ------------ | -------------------- |
| id           | uuid PK      | gen_random_uuid()    |
| user_id      | uuid FK users | —                   |
| raw_content  | text         | —                    |
| source_url   | text         | —                    |
| input_type   | text         | 'text'               |
| status       | text         | 'pending'            |
| created_at   | timestamptz  | now()                |
| processed_at | timestamptz  | —                    |

### `nodes` — meaning units

| Column    | Type           | Default           |
| --------- | -------------- | ----------------- |
| id        | uuid PK        | gen_random_uuid() |
| user_id   | uuid FK users  | —                 |
| input_id  | uuid FK inputs | —                 |
| content   | text NOT NULL  | —                 |
| type      | text           | 'idea'            |
| summary   | text           | —                 |
| embedding | vector(768)    | —                 |
| created_at| timestamptz    | now()             |

Node types: `raw`, `idea`, `source`, `question`, `synthesis`

### `edges` — relationships between nodes

| Column       | Type          | Default           |
| ------------ | ------------- | ----------------- |
| id           | uuid PK       | gen_random_uuid() |
| user_id      | uuid FK users | —                 |
| from_node_id | uuid FK nodes | —                 |
| to_node_id   | uuid FK nodes | —                 |
| relationship | text NOT NULL | —                 |
| strength     | float         | 0.5               |
| reason       | text          | —                 |
| created_at   | timestamptz   | now()             |

Relationship types: `similar`, `supports`, `contradicts`, `refines`, `example_of`, `causes`, `related`

### `folders` — emergent cluster views

| Column      | Type          | Default           |
| ----------- | ------------- | ----------------- |
| id          | uuid PK       | gen_random_uuid() |
| user_id     | uuid FK users | —                 |
| name        | text NOT NULL | —                 |
| description | text          | —                 |
| confidence  | float         | 0.5               |
| created_by  | text          | 'ai'              |
| created_at  | timestamptz   | now()             |

### `folder_nodes` — join table

| Column    | Type           |
| --------- | -------------- |
| folder_id | uuid FK folders|
| node_id   | uuid FK nodes  |
| added_by  | text default 'ai' |
| created_at| timestamptz    |

PK: (folder_id, node_id)

### RLS

All tables have RLS enabled. Policy: `auth.uid() = user_id` for all ops. `folder_nodes` validated through folder ownership.

### `match_nodes` function

```sql
create or replace function match_nodes(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 10
) returns table (id uuid, content text, type text, similarity float)
language sql stable as $$
  select nodes.id, nodes.content, nodes.type,
    1 - (nodes.embedding <=> query_embedding) as similarity
  from nodes
  where nodes.user_id = match_user_id
  order by nodes.embedding <=> query_embedding
  limit match_count;
$$;
```

---

## App Structure

```
/app
  /(auth)/login, /signup
  /(dashboard)/home, /nodes/[id], /folders/[id], /settings
  /api/process-input, /extract-ideas, /create-embedding, /detect-relationships, /suggest-folder
/components
  InputBox, NodeCard, NodeList, NodeConnections, FolderCard, ProcessingResult
/lib
  supabaseClient, supabaseServer, openai, prompts, graph, clustering
/types
  index.ts
```

---

## User Flow

```
User opens app → universal input box → pastes note/link/thought → clicks Process
→ input saved → AI extracts ideas → embeddings created → similar nodes found
→ relationships detected → nodes/edges saved → folder/theme suggested → user sees result
```

---

## AI Pipeline

### Step 1: Save Raw Input

`POST /api/process-input` with `{ raw_content, source_url?, input_type }`.

1. Verify user
2. Insert into `inputs`
3. Send to extraction prompt
4. Continue pipeline

### Step 2: Extract Meaning Nodes

Prompt extracts 3-8 atomic meaning nodes from raw input. Returns `{ summary, nodes[], questions[] }`. Each node has `content` and `type`. Rules: atomic ideas, no vague summaries, no duplicates, preserve uncertainty.

### Step 3: Create Embeddings

For each node: generate embedding → store node with embedding → run `match_nodes` against existing nodes (exclude same-input nodes).

### Step 4: Detect Relationships

Prompt compares new node against nearby existing nodes. Returns relationships with type, strength, reason. Store edges only if `relationship != none` and `strength >= 0.55`.

### Step 5: Suggest Emergent Folder

After new edges, find local neighborhood (direct + second-degree if strength > 0.7). Prompt decides if nodes form a meaningful cluster. Create folder only if `confidence >= 0.75` and `cluster size >= 5`.

---

## Prompts

Stored in `/lib/prompts.ts` as exports: `EXTRACT_IDEAS_PROMPT`, `DETECT_RELATIONSHIPS_PROMPT`, `SUGGEST_FOLDER_PROMPT`, `SYNTHESIZE_FOLDER_PROMPT`. Version-tagged for debugging.

---

## UI Pages

### `/home`

- Universal input box (large textarea, paste-friendly, mobile-optimized)
- Processing result (X nodes created, Y connections, Z themes)
- Recent nodes feed
- Emerging folders

### `/nodes/[id]`

- Node content, type, date, source input
- Connected nodes grouped by relationship type

### `/folders/[id]`

- Folder name, description, AI synthesis
- Nodes in cluster, strongest relationships

---

## Error Handling

1. AI JSON fails → retry once
2. Retry fails → mark input as `failed`
3. Embeddings fail → keep node without embedding
4. Relationship detection fails → still save nodes
5. Never lose raw input

---

## Build Phases

### Phase 1: Foundation
- [x] Next.js + TypeScript + Tailwind setup
- [x] Supabase project + pgvector
- [x] All tables + RLS + match_nodes function
- [x] Auth (login/signup)
- [x] Protected dashboard shell
- [x] Deploy to Vercel

### Phase 2: Input + AI Extraction
- [x] InputBox component
- [x] `POST /api/process-input` — save raw input
- [x] Gemini client + extractIdeas function
- [x] Store extracted nodes
- [x] Recent nodes feed in UI

### Phase 3: Graph
- [x] createEmbedding function (Gemini text-embedding-004, 768d)
- [x] Store embeddings, run match_nodes
- [x] detectRelationships prompt + edge storage
- [x] Node detail page with connections

### Phase 4: Emergence
- [x] Local neighborhood query
- [x] suggestFolder prompt
- [x] Folder creation + node linking
- [x] Folder list on home, folder detail page

### Phase 5: Capture Speed
- [ ] PWA manifest + app icon
- [ ] Mobile UX polish (sticky capture, one-hand use)
- [ ] `POST /api/quick-capture` for iPhone Shortcut
- [ ] Optimistic UI (save immediately, process in background)

---

## Processing Speed Strategy

MVP: synchronous is fine. Better UX: use `status` field (`pending → processing → processed → failed`). Later: background queue (Inngest / Trigger.dev / Supabase Edge Functions / Vercel background jobs).

---

## UI Copy

Use: "Drop anything", "Meaning extracted", "Connections found", "Emerging themes".
Avoid: "Belief database", "Knowledge management", "Taxonomy".

---

## Out of Scope (v1)

Native iOS, browser extension, graph visualization, credibility scoring, public sharing, collaboration, complex taxonomy, manual folder tree.

---

## Future (v1.5+)

1. iPhone Shortcut via `/api/quick-capture`
2. Telegram bot
3. Chrome extension
4. Native app

---

## MVP Done When

1. User logs in
2. Pastes a messy note
3. System saves raw input
4. AI extracts meaning nodes
5. Nodes are embedded
6. Similar previous nodes found
7. Edges created
8. User can click a node and see connections
9. System suggests emergent folder after enough related inputs
10. Folder/theme page viewable
11. Works on phone and laptop
