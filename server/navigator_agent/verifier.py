"""Verifier Agent — determines goal completion and plan step progress.

Uses Gemini to analyze the current UI state against the goal/plan
to determine if the task is complete, in progress, or failed.
"""

from __future__ import annotations

import json
import logging

import google.genai as genai
from google.genai import types as genai_types

from server.config import GEMINI_MODEL, GOOGLE_API_KEY
from server.navigator_agent.action_schema import (
    Plan,
    UIState,
    VerificationResult,
    VerificationStatus,
    format_action_history,
    format_ui_state_for_llm,
    LoopIteration,
)

logger = logging.getLogger(__name__)

client = genai.Client(api_key=GOOGLE_API_KEY)

VERIFIER_SYSTEM_PROMPT = """\
You are a Verification Agent for a desktop automation system. Your job is to analyze \
the current state of the screen and determine whether the user's goal has been achieved.

You receive:
1. The user's goal
2. The current plan (if available) with completed/pending steps
3. The current UI state (detected elements)
4. Recent action history (what actions were taken)
5. An annotated screenshot of the current screen

Your output must be a JSON object with this exact structure:
{
  "status": "complete" | "in_progress" | "failed" | "blocked" | "needs_human",
  "reasoning": "Detailed explanation of your assessment",
  "progress_percent": 0-100,
  "current_step_complete": true/false,
  "current_step_description": "What is happening now",
  "next_action_hint": "Suggestion for what to do next (if not complete)",
  "should_continue": true/false
}

STATUS MEANINGS:
- "complete": The goal is FULLY achieved. All visual evidence confirms success.
- "in_progress": Making progress but not done yet. Continue with next actions.
- "failed": Something went wrong that prevents completion (error dialog, wrong page, etc.).
- "blocked": Waiting for something external (loading, login required, etc.).
- "needs_human": Requires human intervention (CAPTCHA, 2FA, sensitive data entry).

RULES:
- Be CONSERVATIVE about marking "complete" — only if you can see clear evidence.
- A button being clicked is NOT completion — verify the result appeared.
- Loading states mean "blocked" not "complete".
- Error dialogs mean "failed" with specific error description.
- Login pages mean "needs_human" unless the plan includes credentials.
- progress_percent should reflect actual progress, not just steps attempted.

RESPOND ONLY WITH THE JSON OBJECT, no markdown formatting.
"""


async def verify_goal_completion(
    goal: str,
    ui_state: UIState,
    plan: Plan | None = None,
    iterations: list[LoopIteration] | None = None,
    screenshot_bytes: bytes | None = None,
) -> VerificationResult:
    """Verify whether the goal has been achieved based on current UI state.

    Args:
        goal: The user's original goal.
        ui_state: Current UI state with detected elements.
        plan: The plan being followed (optional).
        iterations: History of past iterations (optional).
        screenshot_bytes: Raw screenshot bytes for visual analysis (optional).

    Returns:
        VerificationResult with status, reasoning, and progress.
    """
    # Build the prompt
    prompt_parts = [f"GOAL: {goal}\n"]

    if plan and plan.steps:
        completed = sum(1 for s in plan.steps if s.completed)
        prompt_parts.append(f"PLAN ({completed}/{plan.total_steps} steps completed):")
        for step in plan.steps:
            marker = "✓" if step.completed else ("►" if step.step_number - 1 == plan.current_step else "○")
            prompt_parts.append(f"  {marker} Step {step.step_number}: {step.description}")
        prompt_parts.append("")

    prompt_parts.append("CURRENT UI ELEMENTS:")
    prompt_parts.append(format_ui_state_for_llm(ui_state))
    prompt_parts.append("")

    if iterations:
        prompt_parts.append("RECENT ACTION HISTORY:")
        prompt_parts.append(format_action_history(iterations, max_recent=3))
        prompt_parts.append("")

    prompt_parts.append("Based on the above, assess the goal completion status.")

    user_prompt = "\n".join(prompt_parts)

    # Build content parts
    parts: list[genai_types.Part] = [genai_types.Part(text=user_prompt)]

    # Include screenshot if available for visual verification
    if screenshot_bytes:
        parts.insert(0, genai_types.Part(
            inline_data=genai_types.Blob(
                mime_type="image/jpeg",
                data=screenshot_bytes,
            )
        ))

    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                genai_types.Content(role="user", parts=parts),
            ],
            config=genai_types.GenerateContentConfig(
                system_instruction=VERIFIER_SYSTEM_PROMPT,
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )

        response_text = response.text.strip()
        data = json.loads(response_text)

        status_str = data.get("status", "in_progress")
        status_map = {
            "complete": VerificationStatus.COMPLETE,
            "in_progress": VerificationStatus.IN_PROGRESS,
            "failed": VerificationStatus.FAILED,
            "blocked": VerificationStatus.BLOCKED,
            "needs_human": VerificationStatus.NEEDS_HUMAN,
        }
        status = status_map.get(status_str, VerificationStatus.IN_PROGRESS)

        result = VerificationResult(
            status=status,
            reasoning=data.get("reasoning", ""),
            progress_percent=min(100, max(0, int(data.get("progress_percent", 0)))),
            current_step_description=data.get("current_step_description", ""),
            next_action_hint=data.get("next_action_hint", ""),
            should_continue=data.get("should_continue", status not in (
                VerificationStatus.COMPLETE, VerificationStatus.NEEDS_HUMAN
            )),
        )

        logger.info(
            "Verification: status=%s progress=%d%% continue=%s",
            result.status.value, result.progress_percent, result.should_continue,
        )
        return result

    except json.JSONDecodeError as e:
        logger.warning("Failed to parse verifier response: %s", e)
        return VerificationResult(
            status=VerificationStatus.IN_PROGRESS,
            reasoning=f"Could not parse verification response: {e}",
            progress_percent=0,
            should_continue=True,
        )
    except Exception as e:
        logger.error("Verifier error: %s", e)
        return VerificationResult(
            status=VerificationStatus.IN_PROGRESS,
            reasoning=f"Verification error: {e}",
            progress_percent=0,
            should_continue=True,
        )


def should_verify(iteration: int, last_verification: VerificationResult | None) -> bool:
    """Determine if we should run verification this iteration.

    Verification is expensive (extra LLM call), so we don't do it every turn.
    - Always verify on first iteration
    - Verify every 3 iterations normally
    - Verify every iteration if progress > 70%
    - Always verify if the agent said TASK_COMPLETE
    """
    if iteration == 0:
        return False  # Skip first iteration — need at least one action

    if last_verification and last_verification.progress_percent >= 70:
        return True  # Close to done, verify frequently

    return iteration % 3 == 0  # Otherwise every 3 iterations
