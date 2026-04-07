/** Writing style rule definition for a specific style + sub_type combination */
export interface StyleRule {
  tone: string;
  structure: string;
  emotion: string;
  emoji: string;
  length: string;
  language?: string;
  hashtag?: string;
  quotes?: string;
}

type StyleRulesMap = Record<string, Record<string, StyleRule>>;

/**
 * Static writing style rules for all supported styles and sub_types.
 * Not vector-searched — KISS principle (rules don't change often).
 */
export const STYLE_RULES: StyleRulesMap = {
  facebook_post: {
    lifestyle_philosophy: {
      tone: "philosophical + emotional",
      structure: "hook → insight → metaphor → CTA",
      emotion: "high",
      emoji: "selective (2-4)",
      length: "250-350 words",
      language: "conversational + poetic Vietnamese",
      hashtag: "8-15 tags",
    },
    project_announcement: {
      tone: "exciting + urgent",
      structure: "event → details → CTA",
      emotion: "medium-high",
      emoji: "moderate (3-6)",
      length: "150-250 words",
      language: "direct Vietnamese",
      hashtag: "5-10 tags",
    },
    market_insight: {
      tone: "analytical + authoritative",
      structure: "trend → data → implication → CTA",
      emotion: "low-medium",
      emoji: "minimal (1-2)",
      length: "200-300 words",
      language: "semi-formal Vietnamese",
      hashtag: "5-8 tags",
    },
    testimonial_story: {
      tone: "warm + personal",
      structure: "story → emotion → resolution → CTA",
      emotion: "high",
      emoji: "moderate (3-5)",
      length: "200-300 words",
      language: "conversational Vietnamese",
      hashtag: "5-10 tags",
    },
    teaser: {
      tone: "mysterious + intriguing",
      structure: "hook → partial reveal → curiosity gap → stay tuned CTA",
      emotion: "high",
      emoji: "selective (2-4)",
      length: "80-150 words",
      language: "evocative Vietnamese",
      hashtag: "5-8 tags",
    },
    lifestyle_branding: {
      tone: "aspirational + sophisticated",
      structure: "lifestyle vision → brand value → subtle CTA",
      emotion: "medium-high",
      emoji: "minimal (1-2)",
      length: "150-250 words",
      language: "elegant Vietnamese",
      hashtag: "5-10 tags",
    },
    financial_policy: {
      tone: "informative + reassuring",
      structure: "offer headline → details → deadline → CTA",
      emotion: "low-medium",
      emoji: "minimal (1-2)",
      length: "150-250 words",
      language: "clear formal Vietnamese",
      hashtag: "4-8 tags",
    },
    holiday_greeting: {
      tone: "warm + festive",
      structure: "greeting → well-wishes → brand mention",
      emotion: "high",
      emoji: "moderate (3-6)",
      length: "80-150 words",
      language: "warm conversational Vietnamese",
      hashtag: "4-8 tags",
    },
    sales_opening: {
      tone: "exciting + urgent",
      structure: "announcement → key details → FOMO → CTA",
      emotion: "high",
      emoji: "moderate (3-6)",
      length: "150-250 words",
      language: "energetic Vietnamese",
      hashtag: "6-12 tags",
    },
  },
  news: {
    project_news: {
      tone: "neutral formal",
      structure: "inverted pyramid: headline → who/what/when → details → quotes → context",
      emotion: "low",
      emoji: "none",
      length: "600-1000 words",
      language: "formal Vietnamese journalism",
      quotes: "required: government official + company CEO",
    },
    market_analysis: {
      tone: "analytical + objective",
      structure: "headline → key metric → analysis → outlook",
      emotion: "low",
      emoji: "none",
      length: "500-800 words",
      language: "formal Vietnamese",
    },
    policy_update: {
      tone: "informative + neutral",
      structure: "policy headline → regulation details → impact → quote",
      emotion: "low",
      emoji: "none",
      length: "400-700 words",
      language: "formal Vietnamese",
    },
    company_update: {
      tone: "professional + positive",
      structure: "achievement → context → significance → quote",
      emotion: "low-medium",
      emoji: "none",
      length: "400-600 words",
      language: "formal Vietnamese",
    },
  },
};

/** Get style rule for a style + sub_type pair. Returns null if not found. */
export function getStyleRule(style: string, subType: string): StyleRule | null {
  return STYLE_RULES[style]?.[subType] ?? null;
}

/** List all valid sub_types for a given style */
export function getValidSubTypes(style: string): string[] {
  return Object.keys(STYLE_RULES[style] ?? {});
}
