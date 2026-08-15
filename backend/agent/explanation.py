import json
import os

from google import genai


# =========================================================
# GEMINI CLIENT
# =========================================================

client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY")
)


# =========================================================
# GENERATE INVESTIGATOR EXPLANATION
# =========================================================

def generate_explanation(
    report: dict
) -> dict:

    prompt = f"""
You are a financial crime investigation analyst.

Explain the investigation result for a human investigator.

Use ONLY the evidence provided below.
Do not invent facts.

INVESTIGATION REPORT:

{json.dumps(
    report,
    indent=2,
    default=str
)}

Return these sections:

summary:
why_suspicious:
key_evidence:
investigator_action:

Keep the explanation concise and professional.
"""

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt
        )

        text = response.text.strip()

        return {
            "explanation": text,
            "source": "GEMINI"
        }

    except Exception as e:
        print(
            f"\n[GEMINI EXPLANATION ERROR] "
            f"{type(e).__name__}: {e}\n"
        )

        return {
            "explanation": build_fallback_explanation(
                report
            ),
            "source": "DETERMINISTIC_FALLBACK"
        }


# =========================================================
# DETERMINISTIC FALLBACK
# =========================================================

def build_fallback_explanation(
    report: dict
) -> str:

    risk_level = report.get(
        "risk_level",
        "UNKNOWN"
    )

    score = report.get(
        "risk_score",
        0
    )

    typology = report.get(
        "typology",
        "UNKNOWN"
    )

    recommendation = report.get(
        "recommendation",
        "REVIEW"
    )

    evidence = report.get(
        "evidence",
        []
    )

    evidence_text = "\n".join(
        f"- {item}"
        for item in evidence
    )

    return f"""
summary:
The investigation resulted in a {risk_level} risk
assessment with a score of {score}/100.

why_suspicious:
The transaction evidence indicates a {typology}
pattern requiring further investigation.

key_evidence:
{evidence_text}

investigator_action:
Recommendation: {recommendation}.
Review the identified evidence and connected
transaction activity.
""".strip()
