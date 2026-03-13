"""Structured schemas for the agent loop: UI elements, actions, plans, and verification."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════
#  UI Element Types
# ═══════════════════════════════════════════════════════════════

class ElementType(StrEnum):
    BUTTON = "button"
    INPUT = "input"
    TEXT = "text"
    ICON = "icon"
    CHECKBOX = "checkbox"
    IMAGE = "image"
    LINK = "link"
    DROPDOWN = "dropdown"
    TAB = "tab"
    MENU_ITEM = "menu_item"
    TOOLBAR = "toolbar"
    SCROLLBAR = "scrollbar"
    ELEMENT = "element"  # generic fallback


class UIElement(BaseModel):
    """A single detected UI element with structured metadata."""
    id: int
    type: ElementType
    text: str = ""
    bbox: list[int] = Field(description="[x1, y1, x2, y2] bounding box in screen pixels")
    center: list[int] = Field(default_factory=list, description="[cx, cy] center point")
    confidence: float = 0.0
    source: str = "yolo"  # "yolo", "ocr", "merged"


class UIState(BaseModel):
    """Complete UI state at a point in time — the 'observation'."""
    screenshot_b64: str = ""
    elements: list[UIElement] = Field(default_factory=list)
    screen_width: int = 1920
    screen_height: int = 1080
    timestamp: str = ""
    element_count: int = 0


# ═══════════════════════════════════════════════════════════════
#  Action Types
# ═══════════════════════════════════════════════════════════════

class ActionType(StrEnum):
    CLICK = "click"
    DOUBLE_CLICK = "double_click"
    RIGHT_CLICK = "right_click"
    TYPE = "type"
    PRESS = "press"
    HOTKEY = "hotkey"
    SCROLL = "scroll"
    DRAG = "drag"
    MOVE = "move"
    WAIT = "wait"
    # Special actions
    TASK_COMPLETE = "task_complete"
    TASK_FAILED = "task_failed"
    NEED_VERIFICATION = "need_verification"


class ActionTarget(BaseModel):
    """Target of an action — either an element ID or raw coordinates."""
    element_id: int | None = None
    x: int | None = None
    y: int | None = None
    position: str = "center"  # "center", "top", "left", etc.


class Action(BaseModel):
    """A structured action the agent wants to execute."""
    action: ActionType
    target: ActionTarget = Field(default_factory=ActionTarget)
    parameters: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""
    confidence: float = 1.0


class ActionResult(BaseModel):
    """Result of executing an action."""
    action: Action
    status: str = "success"  # "success", "error", "skipped"
    message: str = ""
    error: str = ""


# ═══════════════════════════════════════════════════════════════
#  Plan / Workflow
# ═══════════════════════════════════════════════════════════════

class PlanStep(BaseModel):
    """A single step in a plan."""
    step_number: int
    description: str
    expected_state: str = ""  # What the screen should look like after this step
    completed: bool = False
    skipped: bool = False


class Plan(BaseModel):
    """A structured plan decomposing a goal into steps."""
    goal: str
    steps: list[PlanStep] = Field(default_factory=list)
    current_step: int = 0
    total_steps: int = 0
    reasoning: str = ""


# ═══════════════════════════════════════════════════════════════
#  Verification / Goal Completion
# ═══════════════════════════════════════════════════════════════

class VerificationStatus(StrEnum):
    COMPLETE = "complete"
    IN_PROGRESS = "in_progress"
    FAILED = "failed"
    BLOCKED = "blocked"
    NEEDS_HUMAN = "needs_human"


class VerificationResult(BaseModel):
    """Result of verifying whether the goal is achieved."""
    status: VerificationStatus
    reasoning: str = ""
    progress_percent: int = 0  # 0-100
    current_step_description: str = ""
    next_action_hint: str = ""
    should_continue: bool = True


# ═══════════════════════════════════════════════════════════════
#  Agent Loop State
# ═══════════════════════════════════════════════════════════════

class LoopIteration(BaseModel):
    """Record of a single observe→reason→act→verify cycle."""
    iteration: int
    ui_state: UIState | None = None
    actions_taken: list[ActionResult] = Field(default_factory=list)
    verification: VerificationResult | None = None
    agent_reasoning: str = ""


class AgentLoopState(BaseModel):
    """Full state of the agent loop across all iterations."""
    goal: str
    plan: Plan | None = None
    iterations: list[LoopIteration] = Field(default_factory=list)
    current_iteration: int = 0
    status: str = "running"  # "running", "complete", "failed", "interrupted"
    action_history_summary: str = ""


# ═══════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════

# Map from old segmenter categories to ElementType
_CATEGORY_MAP = {
    "icon": ElementType.ICON,
    "button": ElementType.BUTTON,
    "text_field": ElementType.INPUT,
    "input": ElementType.INPUT,
    "checkbox": ElementType.CHECKBOX,
    "image": ElementType.IMAGE,
    "text": ElementType.TEXT,
    "link": ElementType.LINK,
    "element": ElementType.ELEMENT,
}


def raw_element_to_ui_element(raw: dict, element_id: int) -> UIElement:
    """Convert a raw detection dict from the segmenter into a UIElement."""
    bbox = raw.get("bbox", [0, 0, 0, 0])
    category = raw.get("category", raw.get("label", "element"))
    elem_type = _CATEGORY_MAP.get(category.lower(), ElementType.ELEMENT)

    cx = raw.get("center_x", (bbox[0] + bbox[2]) // 2)
    cy = raw.get("center_y", (bbox[1] + bbox[3]) // 2)

    return UIElement(
        id=element_id,
        type=elem_type,
        text=raw.get("text", ""),
        bbox=bbox,
        center=[cx, cy],
        confidence=raw.get("confidence", 0.0),
        source=raw.get("source", "yolo"),
    )


def format_ui_state_for_llm(ui_state: UIState) -> str:
    """Format a UIState into a compact text description for the LLM prompt."""
    if not ui_state.elements:
        return "No UI elements detected on screen."

    lines = []
    for el in ui_state.elements:
        parts = [f"[{el.id}]"]
        parts.append(el.type.value)
        if el.text:
            parts.append(f'"{el.text}"')
        parts.append(f"bbox={el.bbox}")
        parts.append(f"center=({el.center[0]},{el.center[1]})")
        if el.confidence > 0:
            parts.append(f"conf={el.confidence:.0%}")
        lines.append(" ".join(parts))

    return "\n".join(lines)


def format_action_history(iterations: list[LoopIteration], max_recent: int = 5) -> str:
    """Format recent action history for the LLM to understand what happened."""
    if not iterations:
        return "No actions taken yet."

    recent = iterations[-max_recent:]
    lines = []
    for it in recent:
        lines.append(f"--- Step {it.iteration + 1} ---")
        if it.agent_reasoning:
            lines.append(f"Reasoning: {it.agent_reasoning[:200]}")
        for ar in it.actions_taken:
            action_desc = f"  {ar.action.action.value}"
            if ar.action.target.element_id is not None:
                action_desc += f" element[{ar.action.target.element_id}]"
            elif ar.action.target.x is not None:
                action_desc += f" ({ar.action.target.x},{ar.action.target.y})"
            if ar.action.reason:
                action_desc += f" — {ar.action.reason}"
            action_desc += f" → {ar.status}"
            if ar.error:
                action_desc += f" ({ar.error})"
            lines.append(action_desc)
        if it.verification:
            lines.append(f"  Verification: {it.verification.status.value} ({it.verification.progress_percent}%)")

    return "\n".join(lines)
