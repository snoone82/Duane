/** The instruction+format templates Duane gives his AI along with a
 * transcript. Copyable from the import screens so the format the AI follows
 * and the format the OS parses can never drift apart. */

export const CLIENT_PROFILE_TEMPLATE = `You are converting a client consultation (transcript or notes) into a structured import for the Aligned Media Personal Brand OS.

RULES — follow these exactly:
1. Output ONLY a single JSON object matching the skeleton below. No commentary before or after.
2. NEVER invent or guess information. If something was not clearly stated, use the exact string "NEEDS_CLIENT_CONFIRMATION".
3. If something genuinely does not apply to this client, use the exact string "NOT_APPLICABLE".
4. Omit optional list sections entirely if nothing was discussed (or use an empty list []).
5. Dates must be YYYY-MM-DD. Numbers must be plain numbers (no currency symbols or commas).
6. content_ideas.pillar and content_ideas.audience must exactly match a name from content_pillars / audiences in this same document — never introduce new ones there.
7. Write in UK English, in the client's own words where possible.
8. For UPDATE imports into an existing client: include ONLY the sections and fields that changed. An omitted field always keeps its current value — never restate a field just to include it, and never use blank values to try to clear something. Omitted sections are left completely untouched.
9. For UPDATE imports, repeatable records (content pillars, audiences, social strategies, authority opportunities, actions) are matched to what already exists — an update never appends a second copy. If the record's PBOS id was given to you, include it as "id" (actions use "action_id"); that is always the safest match. Without an id, PBOS matches on the name, ignoring numbering, arrow style and punctuation, so "Pillar 1 — AI Opportunity → Commercial Decision" is recognised as the existing "AI Opportunity -> Commercial Decision". Never invent an id.
10. A repeatable section may be wrapped as {"mode": "...", "items": [...]} when the default isn't right: "replace" means the list you supply is definitive (anything missing is offered for deletion), "append" means every record is genuinely new. Plain lists mean "update what matches, add what's new" — the default, and correct almost always.

{
  "pbos_import": "client_profile",
  "version": 1,
  "overview": {
    "name": "REQUIRED — client's full name",
    "email": "", "phone": "", "company": "", "job_title": "", "industry": "",
    "location": "", "package": "", "retainer_amount": 0,
    "north_star": "The single guiding sentence for this personal brand",
    "notes": "",
    "website_url": ""
  },
  "vision": {
    "long_term_goal": "", "desired_positioning": "", "authority_goal": "",
    "commercial_goal": "", "impact_goal": "", "legacy_contribution": ""
  },
  "positioning": {
    "current_positioning": "", "desired_positioning": "", "positioning_statement": "",
    "expertise": "", "unique_story": "", "differentiators": "",
    "core_beliefs": "", "contrarian_opinions": ""
  },
  "audiences": [
    {
      "name": "REQUIRED", "description": "", "demographics": "", "stage": "",
      "pain_points": "", "goals": "", "content_interests": "",
      "target_belief": "", "target_action": "", "where_they_are": "", "notes": ""
    }
  ],
  "social_strategies": [
    {
      "platform": "REQUIRED e.g. LinkedIn",
      "account_name": "The account/channel name, e.g. Daniel Andrews or CEG Programme",
      "owner_brand": "Who the account belongs to, e.g. Daniel / CEG",
      "url": "The account URL — social URLs live HERE, never in overview",
      "objective": "", "audience": "",
      "content_types": "", "posting_frequency": "", "growth_strategy": "",
      "engagement_strategy": "", "cta_strategy": ""
    }
  ],
  "content_pillars": [
    {
      "name": "REQUIRED", "description": "", "target_audience": "", "purpose": "",
      "key_messages": "", "example_topics": "", "associated_stories": "",
      "relevant_expertise": "", "calls_to_action": ""
    }
  ],
  "content_ideas": [
    {
      "title": "REQUIRED", "pillar": "name from content_pillars above or null",
      "audience": "name from audiences above or null", "hook": "", "brief": "",
      "notes": "", "priority": "low | medium | high",
      "platforms": ["LinkedIn", "Instagram"]
    }
  ],
  "sales": {
    "services_products": "", "target_customers": "", "ideal_clients": "", "offers": "",
    "sales_messaging": "", "lead_generation_approach": "", "calls_to_action": "",
    "lead_magnets": "", "enquiry_process": "", "sales_conversations": "",
    "referral_opportunities": ""
  },
  "authority_opportunities": [
    {
      "type": "REQUIRED e.g. Podcast / Speaking / Article", "host": "",
      "status": "identified | pitched | in_conversation | booked | completed | published",
      "opportunity_date": "YYYY-MM-DD or null", "audience_size": 0,
      "contact_name": "", "contact_email": "", "notes": ""
    }
  ],
  "consultations": [
    {
      "meeting_date": "YYYY-MM-DD", "meeting_type": "e.g. Initial consultation",
      "summary": "", "attendees": "", "client_updates": "", "wins": "",
      "challenges": "", "strategic_observations": "", "decisions_made": "",
      "content_discussed": "", "commercial_opportunities": "",
      "next_meeting_date": "YYYY-MM-DD or null"
    }
  ],
  "actions": [
    {
      "action_id": "internal PBOS id — include when updating a known existing action, omit for new ones",
      "title": "REQUIRED — for updates, must exactly match the existing action title (or supply action_id)",
      "description": "", "due_date": "YYYY-MM-DD or null", "owner": "person's name or null",
      "status": "Not Started | In Progress | Waiting | Completed",
      "priority": "low | medium | high",
      "visibility": "internal | client (internal = Aligned Media only; client = also visible in the client portal)",
      "checklist": ["Subtask one", "Subtask two — plain strings, or {\\"text\\": \\"...\\", \\"done\\": true} to tick an existing item"]
    }
  ],
  "metric_snapshots": [
    {
      "platform": "REQUIRED", "snapshot_date": "YYYY-MM-DD", "followers": 0,
      "follower_growth": 0, "impressions": 0, "reach": 0, "engagement": 0,
      "profile_visits": 0, "video_views": 0, "comments": 0, "shares": 0, "saves": 0
    }
  ],
  "metric_targets": [
    { "platform": "REQUIRED", "baseline_value": 0, "target_value": 0, "target_date": "YYYY-MM-DD or null" }
  ],
  "milestones": [
    { "title": "REQUIRED", "milestone_date": "YYYY-MM-DD", "description": "", "is_highlighted": false }
  ]
}

Here is the consultation transcript / notes:
`;

/** The Actions-only importer on each client's Actions tab (Duane's ask):
 * the same format the update importer understands, but scoped to actions —
 * take a consultation output or AI-generated action plan and turn it
 * straight into operational tasks with checklists. */
export const ACTIONS_IMPORT_TEMPLATE = `You are converting an action plan (from a consultation, strategy session or AI plan) into structured Actions for the Aligned Media Personal Brand OS.

RULES — follow these exactly:
1. Output ONLY a single JSON object matching the skeleton below. No commentary before or after.
2. One action per distinct task or phase. Put its subtasks in "checklist" — never as separate actions.
3. Existing actions are matched by action_id (a list will be provided) or exact title: matched actions are UPDATED (only the fields you supply change; omitted fields keep their current values); unmatched titles create NEW actions. Nothing is ever deleted.
4. NEVER invent information. Unknown = omit the field. Dates must be YYYY-MM-DD.
5. "owner" is a person's name (Aligned Media team or the client's team) — omit if unassigned.

{
  "pbos_import": "client_profile",
  "version": 1,
  "actions": [
    {
      "action_id": "only when updating a known existing action — omit for new ones",
      "title": "REQUIRED, e.g. Phase 1 — Complete Engineering Business Academy",
      "description": "What this covers and why it matters",
      "due_date": "YYYY-MM-DD or null",
      "owner": "person's name or null",
      "status": "Not Started | In Progress | Waiting | Completed",
      "priority": "low | medium | high",
      "visibility": "internal | client",
      "checklist": ["Subtask one", "Subtask two"]
    }
  ]
}

Here is the action plan to convert:
`;

export const CONTENT_IMPORT_TEMPLATE = `You are converting drafted content into a structured import for the Aligned Media Personal Brand OS content pipeline.

RULES — follow these exactly:
1. Output ONLY a single JSON object matching the skeleton below. No commentary before or after.
2. One master idea per core content concept; the platform-specific versions go in its "outputs" list. NEVER create separate master ideas per platform.
3. "pillar" and "audience" must exactly match names that already exist in this client's approved strategy (they will be provided). If unsure, use null — never invent a pillar or audience.
4. NEVER invent information. Unknown = "NEEDS_CLIENT_CONFIRMATION". Genuinely not applicable = "NOT_APPLICABLE".
5. Dates must be YYYY-MM-DD.

{
  "pbos_import": "content",
  "version": 1,
  "ideas": [
    {
      "title": "REQUIRED — the master idea, e.g. Invisible Authority",
      "pillar": "existing pillar name or null",
      "audience": "existing audience name or null",
      "hook": "The opening line / angle",
      "brief": "What this idea is about and why it matters",
      "requirements": "Asset/production requirements",
      "priority": "low | medium | high",
      "production_due_date": "YYYY-MM-DD or null",
      "target_publish_date": "YYYY-MM-DD or null",
      "outputs": [
        {
          "platform": "REQUIRED e.g. LinkedIn",
          "account": "The publishing account's name from the client's Social tab (will be provided) — one output per account, e.g. LinkedIn — Daniel Andrews and LinkedIn — CEG are two outputs. null if no matching account.",
          "format": "e.g. Carousel / Text post / Reel",
          "caption": "The full final or draft copy for this platform",
          "cta": "", "hashtags": "", "alt_text": "",
          "destination_link": "", "notes": ""
        }
      ]
    }
  ]
}

Here is the content to convert:
`;

/** Platform Strategy import (Duane, 1 Sep 2026): consultation notes → one
 * JSON covering every account → the Social tab's strategy fields. */
export const PLATFORM_STRATEGY_TEMPLATE = `You are converting a social/platform strategy consultation into a structured import for the Aligned Media Personal Brand OS.

RULES — follow these exactly:
1. Output ONLY a single JSON object matching the skeleton below. No commentary before or after.
2. Include one entry per social account discussed. Put EVERY platform in the same file — they are all imported in one operation.
3. NEVER invent information. If something was not discussed, omit the field entirely. Omitted fields keep whatever is already on file; they are never blanked.
4. Use the account_id and exact account names supplied below so each entry lands on the right existing account. PBOS updates existing accounts and never creates new ones.
5. "cross_posting_rule" must be one of: allow (the same idea can run here as-is), adapt (can run here but the copy must be rewritten), selective (only when it genuinely fits), never (don't send shared ideas here).
6. "role_in_strategy" should name one role: authority, discovery, community, conversion, commentary, long-form education, or secondary distribution. A short phrase is fine.
7. "target_cadence" is a number and a period: {"value": 3, "period": "week"} or {"value": 2, "period": "month"}.
8. primary_audience and secondary_audience must exactly match one of the client's existing audience names listed below. If the right audience isn't listed, omit the field.
9. Write in UK English, in the client's own words where possible.

{
  "pbos_import": "social_platform_strategy",
  "version": 1,
  "accounts": [
    {
      "account_id": "the id given below, when you have it",
      "platform": "LinkedIn",
      "account_name": "the exact account name given below",
      "role_in_strategy": "",
      "target_cadence": { "value": 3, "period": "week" },
      "primary_audience": "",
      "secondary_audience": "",
      "cross_posting_rule": "adapt",
      "tone_voice": "",
      "preferred_formats": "",
      "typical_length": "",
      "commercial_balance": "",
      "how_to_open": "",
      "dont_post_here": "",
      "repurposing_rules": "",
      "ai_generation_instructions": "",
      "objective": "",
      "audience_here": "",
      "content_types": "",
      "cta": "",
      "growth_strategy": "",
      "engagement_strategy": ""
    }
  ]
}

Here are the consultation notes to convert:`;
