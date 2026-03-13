"""Planner Agent — decomposes a user goal into a structured plan of steps.

Uses Gemini to analyze the goal and current UI state to produce a Plan
with ordered steps that the navigator agent can follow.
"""

from __future__ import annotations

import json
import logging

import google.genai as genai
from google.genai import types as genai_types

from server.config import GEMINI_MODEL, GOOGLE_API_KEY
from server.navigator_agent.action_schema import (
    Plan,
    PlanStep,
    UIState,
    format_ui_state_for_llm,
)

logger = logging.getLogger(__name__)

client = genai.Client(api_key=GOOGLE_API_KEY)

PLANNER_SYSTEM_PROMPT = """\
You are a Task Planner for a desktop automation system. Your job is to decompose \
a user's goal into a clear, ordered sequence of UI steps.

You receive:
1. The user's goal (what they want to accomplish)
2. The current UI state (screenshot description + detected elements)
3. System info (OS, screen resolution)

Your output must be a JSON object with this exact structure:
{
  "goal": "the original goal",
  "reasoning": "your analysis of how to accomplish this goal",
  "steps": [
    {
      "step_number": 1,
      "description": "Clear description of what to do",
      "expected_state": "What the screen should look like after this step"
    },
    ...
  ]
}

RULES:
- Break complex goals into 3-10 atomic steps.
- Each step should be a single logical UI action or small group of related actions.
- Be specific: "Click the 'File' menu" not "Open the menu".
- Include wait/verification steps where the UI needs time to load.
- If the goal requires navigation (opening apps, URLs), include those steps.
- If the current UI already shows progress toward the goal, skip completed steps.
- Keep steps high-level enough that the navigator agent can figure out the exact clicks.
- Always end with a verification step ("Verify that X is visible/complete").

RESPOND ONLY WITH THE JSON OBJECT, no markdown formatting.
"""


async def create_plan(
    goal: str,
    ui_state: UIState | None = None,
    screen_width: int = 1920,
    screen_height: int = 1080,
) -> Plan:
    """Create a structured plan for achieving the given goal.

    Args:
        goal: The user's goal in natural language.
        ui_state: Current UI state (optional, for context-aware planning).
        screen_width: Screen width in pixels.
        screen_height: Screen height in pixels.

    Returns:
        A Plan object with ordered steps.
    """
    # Build the user prompt
    prompt_parts = [f"GOAL: {goal}\n"]
    prompt_parts.append(f"System: Windows, Screen: {screen_width}x{screen_height}\n")

    if ui_state and ui_state.elements:
        prompt_parts.append("CURRENT UI STATE:")
        prompt_parts.append(f"{ui_state.element_count} elements detected:")
        prompt_parts.append(format_ui_state_for_llm(ui_state))
    else:
        prompt_parts.append("CURRENT UI STATE: No screenshot available yet (starting fresh).")

    prompt_parts.append("\nCreate a step-by-step plan to accomplish this goal.")

    user_prompt = "\n".join(prompt_parts)

    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                genai_types.Content(
                    role="user",
                    parts=[genai_types.Part(text=user_prompt)],
                ),
            ],
            config=genai_types.GenerateContentConfig(
                system_instruction=PLANNER_SYSTEM_PROMPT,
                temperature=0.3,
                response_mime_type="application/json",
            ),
        )

        response_text = response.text.strip()
        # Parse the JSON response
        plan_data = json.loads(response_text)

        steps = []
        for s in plan_data.get("steps", []):
            steps.append(PlanStep(
                step_number=s.get("step_number", len(steps) + 1),
                description=s.get("description", ""),
                expected_state=s.get("expected_state", ""),
            ))

        plan = Plan(
            goal=goal,
            steps=steps,
            current_step=0,
            total_steps=len(steps),
            reasoning=plan_data.get("reasoning", ""),
        )

        logger.info("Created plan with %d steps for goal: %s", len(steps), goal[:50])
        return plan

    except json.JSONDecodeError as e:
        logger.warning("Failed to parse planner response as JSON: %s", e)
        # Fallback: create a simple single-step plan
        return Plan(
            goal=goal,
            steps=[PlanStep(
                step_number=1,
                description=f"Complete the goal: {goal}",
                expected_state="Goal is fully achieved",
            )],
            current_step=0,
            total_steps=1,
            reasoning="Failed to create detailed plan, using single-step fallback.",
        )
    except Exception as e:
        logger.error("Planner error: %s", e)
        return Plan(
            goal=goal,
            steps=[PlanStep(
                step_number=1,
                description=f"Complete the goal: {goal}",
                expected_state="Goal is fully achieved",
            )],
            current_step=0,
            total_steps=1,
            reasoning=f"Planner error: {e}. Using single-step fallback.",
        )


def get_current_step_context(plan: Plan) -> str:
    """Get a description of the current plan step and overall progress."""
    if not plan.steps:
        return f"Goal: {plan.goal}"

    completed = sum(1 for s in plan.steps if s.completed)
    current_idx = plan.current_step

    lines = [f"GOAL: {plan.goal}"]
    lines.append(f"PLAN PROGRESS: {completed}/{plan.total_steps} steps completed\n")

    for i, step in enumerate(plan.steps):
        marker = "✓" if step.completed else ("►" if i == current_idx else "○")
        lines.append(f"  {marker} Step {step.step_number}: {step.description}")
        if i == current_idx and step.expected_state:
            lines.append(f"    Expected after: {step.expected_state}")

    if current_idx < len(plan.steps):
        lines.append(f"\nCURRENT FOCUS: Step {plan.steps[current_idx].step_number}: {plan.steps[current_idx].description}")

    return "\n".join(lines)


def advance_plan(plan: Plan) -> Plan:
    """Mark the current step as completed and advance to the next."""
    if plan.current_step < len(plan.steps):
        plan.steps[plan.current_step].completed = True
        plan.current_step += 1
    return plan
