import json
import os

from google import genai


client = None


def get_client():
    """Create a Gemini client only for live, API-backed planning."""
    global client

    if client is None:
        api_key = os.environ.get("GEMINI_API_KEY")

        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured.")

        client = genai.Client(api_key=api_key)

    return client


# =========================================================
# INVESTIGATION PLAN TOOL
# =========================================================

PLAN_TOOL = {
    "type": "function",
    "name": "create_investigation_plan",
    "description": (
        "Create an ordered investigation plan by selecting "
        "the evidence sources that should be collected."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "tools": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": [
                        "get_transactions",
                        "get_kyc",
                        "get_linked_accounts",
                        "get_complaints"
                    ]
                },
                "description": (
                    "Ordered list of investigation tools "
                    "that should be executed."
                )
            },
            "reason": {
                "type": "string",
                "description": (
                    "Short explanation of why this "
                    "investigation plan is appropriate."
                )
            }
        },
        "required": [
            "tools",
            "reason"
        ]
    }
}


# =========================================================
# GEMINI INVESTIGATION PLANNER
# =========================================================

def choose_investigation_plan(
    account_key: str,
    observations: list
) -> dict:

    prompt = f"""
You are an AI financial-crime investigation planner.

Your job is to decide which evidence sources should be
collected to investigate this suspicious financial account.

ACCOUNT:
{account_key}

CURRENT EVIDENCE:
{json.dumps(
    observations,
    indent=2,
    default=str
)}

AVAILABLE EVIDENCE TOOLS:

1. get_transactions
   Transaction history, amounts, counterparties,
   currencies and payment information.

2. get_kyc
   KYC status, customer risk rating and account information.

3. get_linked_accounts
   Accounts directly connected through transactions.

4. get_complaints
   Complaints associated with the account.

RULES:

- Select only tools that are useful for this investigation.
- Do not invent evidence.
- Do not select the same tool twice.
- Return the tools in the order they should be executed.
- Use the available evidence to decide what is still missing.
- Prefer sufficient evidence collection before risk assessment.
"""

    try:

        interaction = get_client().interactions.create(
            model="gemini-3.6-flash",
            input=prompt,
            tools=[PLAN_TOOL]
        )

        for item in interaction.outputs:

            if getattr(
                item,
                "type",
                None
            ) == "function_call":

                arguments = item.arguments

                if isinstance(
                    arguments,
                    str
                ):
                    arguments = json.loads(
                        arguments
                    )

                return {
                    "tools": arguments.get(
                        "tools",
                        []
                    ),
                    "reason": arguments.get(
                        "reason",
                        ""
                    )
                }

        raise RuntimeError(
            "Gemini returned no investigation plan."
        )

    except Exception as e:

        print(
            f"\n[GEMINI PLANNER ERROR] "
            f"{type(e).__name__}: {e}\n"
        )

        return None
