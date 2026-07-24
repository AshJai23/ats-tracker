const ALLOWED_ORIGINS = new Set([
  "https://ashjai23.github.io",
  "http://localhost:8765",
]);

const MODEL = "claude-opus-4-8";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    rewrittenBullets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          rewritten: { type: "string" },
          note: { type: "string" },
        },
        required: ["original", "rewritten", "note"],
        additionalProperties: false,
      },
    },
    finalResume: { type: "string" },
    template: { type: "string" },
  },
  required: ["rewrittenBullets", "finalResume", "template"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are AJ.ai, an assistant that helps rewrite resume bullets using Google's well-known XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]."

Rules:
- Only use facts already present in the resume or job description. Never invent metrics, numbers, employers, titles, or achievements.
- If a bullet has no number/metric, rewrite it in XYZ structure but leave an explicit bracketed placeholder like [add a number: team size, %, $, or time] instead of making one up.
- Keep rewritten bullets to one line each, no more than ~30 words.
- rewrittenBullets should cover the weak/generic bullets from the resume (skip ones that are already strong).
- finalResume should be the full original resume text with the weak bullets replaced by their rewritten versions, keeping all other sections (contact info, headers, education, etc.) unchanged.
- template should be a short, generic, reusable ATS-friendly resume section template (Summary / Experience bullet / Skills line) written in the XYZ style with bracketed placeholders, not tied to this specific candidate.
- Output must be valid JSON matching the provided schema only. No markdown, no commentary outside the JSON.`;

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://ashjai23.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { resumeText, jdText } = body;
    if (!resumeText || !jdText) {
      return new Response(JSON.stringify({ error: "resumeText and jdText are required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const userMessage = `JOB DESCRIPTION:\n${jdText}\n\nRESUME:\n${resumeText}`;

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        output_config: {
          format: { type: "json_schema", schema: OUTPUT_SCHEMA },
        },
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      return new Response(JSON.stringify({ error: "Claude API error", detail: errText }), {
        status: 502,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicResp.json();

    if (data.stop_reason === "refusal") {
      return new Response(JSON.stringify({ error: "Request was declined by safety filters" }), {
        status: 422,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) {
      return new Response(JSON.stringify({ error: "No content returned" }), {
        status: 502,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return new Response(JSON.stringify({ error: "Model output was not valid JSON" }), {
        status: 502,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  },
};
