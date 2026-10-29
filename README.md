# ATS Tracker / AJ.ai

A browser-based CV and job-description assistant for understanding formatting issues, finding missing keywords and improving experience bullets with AI-assisted XYZ rewriting.

## What it does

- **Diagnose:** review CV text and formatting against a target job description.
- **Compare keywords:** show matched/missing terms and recognised hard skills.
- **Rewrite:** request AI-assisted bullet suggestions in XYZ format.
- **Review and copy:** inspect the rewritten CV and reusable template before using them.

**Niche:** job-application preparation and career support. **Tools:** HTML, CSS, JavaScript, PDF.js and Mammoth for document reading, plus a server integration for AI rewriting. The repository also includes a Cloudflare Worker implementation under `worker/`.

## Data flow

The first two steps run in the browser. AI rewrite steps send the CV and job-description text to the configured server. Review the configuration before submitting personal documents. A keyword score is a diagnostic aid; it is not an employer's ATS decision or a guarantee of an interview.

## Explore the code

- `index.html`: the four-step interface.
- `app.js` and `skills.js`: browser workflow, keyword/skills processing and server requests.
- `style.css`: application styling.
- `worker/`: server integration source.

This description was checked against the repository interface and structure on 29 October 2026. It does not claim a new deployment, backend availability or end-to-end AI validation.
