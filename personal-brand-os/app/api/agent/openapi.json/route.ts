import { NextResponse } from "next/server";

/**
 * The schema ChatGPT imports to learn that PBOS exists.
 *
 * Building the API was only half of it: an endpoint ChatGPT has never been
 * told about is a door with no key. A GPT Action is configured by importing
 * an OpenAPI document, so PBOS serves its own — from the deployment itself,
 * so the description can never drift from the code the way a pasted copy
 * would.
 *
 * Deliberately unauthenticated. ChatGPT fetches this while *setting up* the
 * action, before it holds a token, and the document describes shapes rather
 * than revealing anything: no data, no ids, no secrets.
 *
 * ── Two constraints the GPT Action editor imposes ────────────────────────
 *
 * 1. Every operation `description` must be under 300 characters. These
 *    descriptions are how a model decides which operation to call, so the
 *    limit is a real constraint on what can be said, not a formatting
 *    nicety. Each one below keeps the decision-relevant part — when to
 *    reach for it, and the one behaviour that prevents a mistake — and the
 *    longer guidance lives in the GPT's own instructions instead (see
 *    docs/agent-api.md).
 *
 * 2. `components.schemas` must exist and be an object. Declaring
 *    `components` with only `securitySchemes` fails validation. Defining
 *    the shapes there properly is better anyway: the action shape was
 *    inlined four times before, which is four places to forget to update.
 */

const ACTION_REF = { $ref: "#/components/schemas/Action" } as const;
const STATUS_VALUES = ["open", "in_progress", "waiting", "blocked", "complete", "cancelled"] as const;

const DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "Personal Brand OS — Actions",
    description:
      "The Aligned Media Personal Brand OS (PBOS) task layer. PBOS is the permanent record of what has been " +
      "committed to, for whom, by when, and whether it actually happened. Read the current state before answering " +
      "questions about outstanding work, and write back when something changes. Never hold task state in " +
      "conversation — read it from PBOS and write it to PBOS.",
    version: "1.0.0",
  },
  servers: [{ url: "https://app.thealignedmedia.com" }],
  paths: {
    "/api/agent/actions": {
      get: {
        operationId: "listActions",
        summary: "List or search actions",
        description:
          "Read actions from PBOS. Use before answering anything about outstanding, overdue, waiting or due work. " +
          "Also use q= to find an existing action before updating it, so you change the real record rather than " +
          "creating a duplicate.",
        parameters: [
          {
            name: "client",
            in: "query",
            description:
              "Client name (e.g. Daniel, Jonny Gallanders) or PBOS client id. A name matching two clients returns 409 — ask which one rather than guessing.",
            schema: { type: "string" },
          },
          {
            name: "status",
            in: "query",
            description: "One status, or 'open' meaning anything unfinished (open, in progress, waiting or blocked).",
            schema: { type: "string", enum: [...STATUS_VALUES] },
          },
          {
            name: "due",
            in: "query",
            description:
              "Date window; each only returns unfinished work. 'today' for today's commitments, 'overdue' for anything past its date, 'week' for the next seven days. For a daily review call this once per list alongside status=waiting and status=blocked.",
            schema: { type: "string", enum: ["today", "overdue", "week"] },
          },
          { name: "owner", in: "query", description: "Partial owner name.", schema: { type: "string" } },
          {
            name: "waiting_on",
            in: "query",
            description: "Partial name of whoever it waits on.",
            schema: { type: "string" },
          },
          {
            name: "q",
            in: "query",
            description:
              "Partial action title — use this to find the action someone referred to in passing, e.g. 'the Facebook one'.",
            schema: { type: "string" },
          },
          {
            name: "since",
            in: "query",
            description: "ISO timestamp; only actions changed after it.",
            schema: { type: "string" },
          },
          { name: "limit", in: "query", description: "1-200, default 100.", schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Matching actions.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ActionList" } } },
          },
        },
      },
      post: {
        operationId: "createAction",
        summary: "Create an action",
        description:
          "Record a new commitment in PBOS — asked for directly, or detected in an email or meeting. Check with " +
          "listActions q= first that it is not already recorded. Set source and source_reference so it can be " +
          "traced back to where it came from.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateAction" } } },
        },
        responses: {
          "201": {
            description: "Created.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ActionResponse" } } },
          },
        },
      },
    },
    "/api/agent/clients": {
      get: {
        operationId: "findClient",
        summary: "Find a client and get its PBOS id",
        description:
          "Search clients by name or company. Always returns a list — check it before acting. Use this first when a " +
          "request names a client, then work from the returned id rather than the name.",
        parameters: [
          { name: "q", in: "query", description: "Partial name or company. Omit to list all clients.", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Matching clients.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    count: { type: "integer" },
                    clients: { type: "array", items: { $ref: "#/components/schemas/ClientMatch" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/agent/clients/{id}/{section}": {
      get: {
        operationId: "getClientSection",
        summary: "Read a client's approved record",
        description:
          "Read live client data from PBOS: 'overview' (north star, commercial priority, tier), 'profile' " +
          "(positioning, vision, goals), 'content-strategy' (audiences, pillars, guidelines), 'social-profiles' " +
          "(accounts, live bios, cadence). Read these before writing any content.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "PBOS client id, or a client name. A name matching two clients returns 409 — ask which, then use the id.",
            schema: { type: "string" },
          },
          {
            name: "section",
            in: "path",
            required: true,
            description:
              "Which part to read. Use overview for commercial context, profile for positioning and long-term goals, content-strategy for audiences, pillars, tone and things to avoid, social-profiles for each account's current bio, cadence and format rules.",
            schema: { type: "string", enum: ["overview", "profile", "content-strategy", "social-profiles"] },
          },
        ],
        responses: {
          "200": {
            description: "The requested section. Fields carry updated_at where PBOS records one — check it before treating a value as current.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    client: { $ref: "#/components/schemas/ClientRef" },
                    section: { type: "string" },
                    data: { type: "object", description: "Shape depends on the section requested." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/agent/actions/{id}": {
      get: {
        operationId: "getAction",
        summary: "Read one action",
        description: "Fetch a single action by its PBOS id.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "The action.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ActionResponse" } } },
          },
        },
      },
      patch: {
        operationId: "updateAction",
        summary: "Update or complete an action",
        description:
          "Change an existing action: complete it, move it to waiting, change the date, owner or priority, or add " +
          "a note. Send ONLY the fields that change — everything else is left untouched, so this cannot duplicate " +
          "a record. Calling it with no changes records that you checked.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateAction" } } },
        },
        responses: {
          "200": {
            description: "Updated.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ActionResponse" } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ClientMatch: {
        type: "object",
        properties: {
          id: { type: "string", description: "The canonical PBOS client id. Use this for every subsequent call." },
          name: { type: "string" },
          company: { type: "string", nullable: true },
          status: { type: "string" },
        },
      },
      ClientRef: {
        type: "object",
        description: "Which client was actually read — confirm it is the one you meant.",
        properties: { id: { type: "string" }, name: { type: "string" } },
      },
      Action: {
        type: "object",
        properties: {
          id: { type: "string", description: "PBOS id. Use it to update or complete this action later." },
          client_id: { type: "string" },
          client_name: { type: "string", nullable: true, description: "The client this belongs to, e.g. Daniel Andrews." },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: [...STATUS_VALUES] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          owner: { type: "string", nullable: true },
          due_date: { type: "string", nullable: true, description: "YYYY-MM-DD." },
          waiting_on: { type: "string", nullable: true, description: "Who it is waiting on, when status is waiting." },
          source: { type: "string", description: "Where it came from — outlook, chatgpt, meeting, calendar, manual." },
          source_reference: { type: "string", nullable: true, description: "Id in that source: an email id, meeting id." },
          completion_evidence: { type: "string", nullable: true, description: "Why we believe it is done." },
          created_by_agent: { type: "boolean" },
          last_checked_at: {
            type: "string",
            nullable: true,
            description: "When an agent last verified this against reality. Use it to spot commitments nobody has checked.",
          },
          completed_at: { type: "string", nullable: true },
          created_at: { type: "string" },
          updated_at: { type: "string" },
          overdue: { type: "boolean", description: "Already computed — due before today and not finished." },
        },
      },
      ActionList: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          today: { type: "string", description: "Today's date in the operator's timezone." },
          count: { type: "integer" },
          actions: { type: "array", items: ACTION_REF },
        },
      },
      ActionResponse: {
        type: "object",
        properties: { ok: { type: "boolean" }, action: ACTION_REF },
      },
      CreateAction: {
        type: "object",
        required: ["client", "title", "owner"],
        properties: {
          client: { type: "string", description: "Client name or id." },
          title: { type: "string", description: "What has to happen, in a few words." },
          description: { type: "string", description: "Any detail or context worth keeping." },
          owner: { type: "string", description: "Who is responsible — a person's name." },
          due_date: { type: "string", description: "YYYY-MM-DD." },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "'urgent' is accepted and stored as high.",
          },
          status: { type: "string", enum: [...STATUS_VALUES] },
          waiting_on: { type: "string", description: "Required when status is waiting." },
          source: { type: "string", enum: ["outlook", "chatgpt", "calendar", "meeting", "manual", "agent"] },
          source_reference: { type: "string", description: "Email id, meeting id, or similar." },
          completion_evidence: { type: "string" },
        },
      },
      UpdateAction: {
        type: "object",
        properties: {
          status: { type: "string", enum: [...STATUS_VALUES] },
          waiting_on: { type: "string", description: "Who it now waits on. Setting this implies status waiting." },
          due_date: { type: "string", description: "YYYY-MM-DD, or empty to clear." },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          owner: { type: "string" },
          title: { type: "string" },
          description: {
            type: "string",
            description: "Replaces the description. To add without losing what is there, use append_note.",
          },
          append_note: {
            type: "string",
            description: "Adds a timestamped line to the description, keeping the history.",
          },
          completion_evidence: {
            type: "string",
            description: "How you know it is done — user confirmed, email sent, client replied, content published. Send this whenever marking complete.",
          },
          source: { type: "string" },
          source_reference: { type: "string" },
        },
      },
    },
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
  security: [{ bearerAuth: [] }],
};

export function GET() {
  return NextResponse.json(DOCUMENT, {
    headers: {
      // Short cache: re-importing after a change shouldn't serve a stale
      // description of endpoints that have moved on.
      "Cache-Control": "public, max-age=300",
    },
  });
}
