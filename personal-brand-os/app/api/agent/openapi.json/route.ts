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
 * The descriptions are load-bearing. A model chooses which operation to call
 * by reading them, so each one says when to use it in the words someone
 * would actually say ("what's outstanding for Daniel"), not just what it
 * does mechanically.
 */

const ACTION_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", description: "PBOS id for this action. Use it to update or complete the action later." },
    client_id: { type: "string" },
    client_name: { type: "string", nullable: true, description: "The client this belongs to, e.g. Daniel Andrews." },
    title: { type: "string" },
    description: { type: "string" },
    status: {
      type: "string",
      enum: ["open", "in_progress", "waiting", "blocked", "complete", "cancelled"],
    },
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
} as const;

const DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "Personal Brand OS — Actions",
    description:
      "The Aligned Media Personal Brand OS (PBOS) task layer. PBOS is the permanent record of what has been " +
      "committed to, for whom, by when, and whether it actually happened. Use these operations to read the current " +
      "state before answering questions about outstanding work, and to write back when the user says something has " +
      "changed. Never hold task state in conversation — read it from PBOS and write it to PBOS.",
    version: "1.0.0",
  },
  servers: [{ url: "https://app.thealignedmedia.com" }],
  paths: {
    "/api/agent/actions": {
      get: {
        operationId: "listActions",
        summary: "List or search actions",
        description:
          "Read actions from PBOS. Use this before answering anything about what is outstanding, overdue, waiting, " +
          "or due — for a client, an owner, or across the whole agency. Also use it to FIND an existing action by " +
          "title (the q parameter) before updating it, so you update the real record rather than creating a " +
          "duplicate. For a daily review, call it once per list: due=today, due=overdue, status=waiting, " +
          "status=blocked.",
        parameters: [
          {
            name: "client",
            in: "query",
            description: "Client name (e.g. Daniel, Jonny Gallanders) or PBOS client id. A name matching two clients returns 409 — ask which one rather than guessing.",
            schema: { type: "string" },
          },
          {
            name: "status",
            in: "query",
            description: "One status, or 'open' meaning anything unfinished (open, in progress, waiting or blocked).",
            schema: { type: "string", enum: ["open", "in_progress", "waiting", "blocked", "complete", "cancelled"] },
          },
          {
            name: "due",
            in: "query",
            description: "Date window; each one only returns unfinished work. 'today' for today's commitments, 'overdue' for anything past its date, 'week' for the next seven days.",
            schema: { type: "string", enum: ["today", "overdue", "week"] },
          },
          { name: "owner", in: "query", description: "Partial owner name.", schema: { type: "string" } },
          { name: "waiting_on", in: "query", description: "Partial name of whoever it waits on.", schema: { type: "string" } },
          {
            name: "q",
            in: "query",
            description: "Partial action title — use this to find the action someone referred to in passing, e.g. 'the Facebook one'.",
            schema: { type: "string" },
          },
          { name: "since", in: "query", description: "ISO timestamp; only actions changed after it.", schema: { type: "string" } },
          { name: "limit", in: "query", description: "1-200, default 100.", schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Matching actions.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    today: { type: "string", description: "Today's date in the operator's timezone." },
                    count: { type: "integer" },
                    actions: { type: "array", items: ACTION_SCHEMA },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: "createAction",
        summary: "Create an action",
        description:
          "Record a new commitment in PBOS — typically because the user asked for one, or because a commitment was " +
          "detected in an email or meeting ('I'll send that to Daniel by Friday'). Before creating, consider calling " +
          "listActions with q= to check the same commitment isn't already recorded. Always set source and " +
          "source_reference when the commitment came from somewhere identifiable, so it can be traced back later.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["client", "title", "owner"],
                properties: {
                  client: { type: "string", description: "Client name or id." },
                  title: { type: "string", description: "What has to happen, in a few words." },
                  description: { type: "string", description: "Any detail or context worth keeping." },
                  owner: { type: "string", description: "Who is responsible — a person's name." },
                  due_date: { type: "string", description: "YYYY-MM-DD." },
                  priority: { type: "string", enum: ["low", "medium", "high"], description: "'urgent' is accepted and stored as high." },
                  status: { type: "string", enum: ["open", "in_progress", "waiting", "blocked", "complete", "cancelled"] },
                  waiting_on: { type: "string", description: "Required when status is waiting." },
                  source: { type: "string", enum: ["outlook", "chatgpt", "calendar", "meeting", "manual", "agent"] },
                  source_reference: { type: "string", description: "Email id, meeting id, or similar." },
                  completion_evidence: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created.",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean" }, action: ACTION_SCHEMA } },
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
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean" }, action: ACTION_SCHEMA } },
              },
            },
          },
        },
      },
      patch: {
        operationId: "updateAction",
        summary: "Update or complete an action",
        description:
          "Change an existing action — mark it complete, move it to waiting, change the date, owner or priority, or " +
          "add a note. Send ONLY the fields that are changing; everything else is left exactly as it was, so this " +
          "can never create a duplicate. Setting waiting_on alone implies status waiting. Marking complete should " +
          "normally carry completion_evidence saying how you know. Calling this with no changes at all is valid and " +
          "useful: it records that the action was checked and nothing had moved.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["open", "in_progress", "waiting", "blocked", "complete", "cancelled"] },
                  waiting_on: { type: "string", description: "Who it now waits on. Setting this implies status waiting." },
                  due_date: { type: "string", description: "YYYY-MM-DD, or empty to clear." },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                  owner: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string", description: "Replaces the description. To add without losing what's there, use append_note." },
                  append_note: { type: "string", description: "Adds a timestamped line to the description, keeping the history." },
                  completion_evidence: { type: "string", description: "How you know it is done — user confirmed, email sent, client replied, content published." },
                  source: { type: "string" },
                  source_reference: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated.",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean" }, action: ACTION_SCHEMA } },
              },
            },
          },
        },
      },
    },
  },
  components: {
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
