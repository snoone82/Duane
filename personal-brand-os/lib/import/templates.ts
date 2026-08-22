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
    { "title": "REQUIRED", "description": "", "due_date": "YYYY-MM-DD or null", "owner": "person's name or null" }
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
