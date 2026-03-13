"""Perception Layer — converts raw segmentation output into structured UIState.

This module bridges the segmenter (YOLO + OCR) and the agent by:
1. Taking raw screenshot + detections from the segmenter
2. Producing a clean, structured UIState with typed UIElements
3. Enhancing element classification using spatial relationships
4. Generating the formatted text representation for the LLM
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from server.navigator_agent.action_schema import (
    ElementType,
    UIElement,
    UIState,
    raw_element_to_ui_element,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
#  Element Enhancement
# ═══════════════════════════════════════════════════════════════

def _enhance_element_type(element: UIElement, all_elements: list[UIElement]) -> UIElement:
    """Refine element type using contextual heuristics.

    The raw segmenter classifies everything from YOLO as 'icon' and uses
    simple geometry to guess types. We improve this with:
    - Text content analysis (e.g., "Submit" → button, "Email" → input label)
    - Spatial grouping (text near an input → input label)
    - Size/aspect ratio refinements
    """
    text_lower = element.text.lower().strip()
    bbox = element.bbox
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    aspect = w / max(h, 1)

    # If it's already from OCR, keep it as text unless it looks interactive
    if element.source == "ocr":
        # Short text that looks like a button label
        button_keywords = {"submit", "login", "sign in", "sign up", "cancel", "ok",
                           "close", "save", "delete", "next", "back", "continue",
                           "confirm", "apply", "reset", "search", "send", "yes", "no"}
        if text_lower in button_keywords:
            element.type = ElementType.BUTTON
        # Text that looks like a link
        elif text_lower.startswith("http") or text_lower.startswith("www"):
            element.type = ElementType.LINK
        return element

    # For YOLO detections, enhance based on geometry + text
    if element.type == ElementType.ICON:
        # Wide, short, with text → likely a button or tab
        if text_lower and aspect > 1.8 and h < 60:
            element.type = ElementType.BUTTON
        # Very wide without text → likely an input field
        elif not text_lower and aspect > 3.5 and h < 50:
            element.type = ElementType.INPUT
        # Small square → checkbox or icon
        elif w < 30 and h < 30 and 0.7 < aspect < 1.4:
            element.type = ElementType.CHECKBOX
        # Tab-like: moderate width, short, has text
        elif text_lower and 1.2 < aspect < 4.0 and h < 40:
            element.type = ElementType.TAB

    # Detect dropdown indicators
    if element.type in (ElementType.BUTTON, ElementType.ELEMENT):
        dropdown_indicators = {"▼", "▾", "expand", "dropdown", "select"}
        if any(ind in text_lower for ind in dropdown_indicators):
            element.type = ElementType.DROPDOWN

    return element


def _group_nearby_elements(elements: list[UIElement]) -> list[UIElement]:
    """Associate nearby text elements with interactive elements.

    When a text element is directly above or to the left of an input/button,
    it's likely a label. We attach that text to the interactive element.
    """
    text_elements = [e for e in elements if e.type == ElementType.TEXT and e.text]
    interactive = [e for e in elements if e.type in (
        ElementType.INPUT, ElementType.BUTTON, ElementType.DROPDOWN, ElementType.CHECKBOX
    )]

    for te in text_elements:
        tx_center = te.center
        te_bottom = te.bbox[3]
        te_right = te.bbox[2]

        for ie in interactive:
            ix_center = ie.center
            ie_top = ie.bbox[1]
            ie_left = ie.bbox[0]

            # Text is directly above (within 30px) and horizontally aligned
            if (0 < ie_top - te_bottom < 30 and
                    abs(tx_center[0] - ix_center[0]) < 100):
                if not ie.text:
                    ie.text = te.text
                break

            # Text is directly to the left (within 20px) and vertically aligned
            if (0 < ie_left - te_right < 20 and
                    abs(tx_center[1] - ix_center[1]) < 15):
                if not ie.text:
                    ie.text = te.text
                break

    return elements


# ═══════════════════════════════════════════════════════════════
#  Main Perception Function
# ═══════════════════════════════════════════════════════════════

def build_ui_state(
    screenshot_b64: str,
    raw_elements: list[dict],
    screen_width: int = 1920,
    screen_height: int = 1080,
) -> UIState:
    """Convert raw segmentation output into a structured UIState.

    Args:
        screenshot_b64: Base64-encoded annotated screenshot.
        raw_elements: List of raw element dicts from the segmenter.
        screen_width: Logical screen width.
        screen_height: Logical screen height.

    Returns:
        A structured UIState with typed, enhanced UIElements.
    """
    # Convert raw dicts to UIElement objects
    ui_elements: list[UIElement] = []
    for i, raw in enumerate(raw_elements):
        elem_id = raw.get("id", i + 1)
        element = raw_element_to_ui_element(raw, elem_id)
        ui_elements.append(element)

    # Enhance element types using heuristics
    ui_elements = [_enhance_element_type(el, ui_elements) for el in ui_elements]

    # Group nearby text with interactive elements
    ui_elements = _group_nearby_elements(ui_elements)

    return UIState(
        screenshot_b64=screenshot_b64,
        elements=ui_elements,
        screen_width=screen_width,
        screen_height=screen_height,
        timestamp=datetime.now(timezone.utc).isoformat(),
        element_count=len(ui_elements),
    )


def get_elements_summary(ui_state: UIState) -> dict:
    """Get a quick summary of element types in the UI state."""
    type_counts: dict[str, int] = {}
    for el in ui_state.elements:
        t = el.type.value
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "total": ui_state.element_count,
        "by_type": type_counts,
        "has_inputs": type_counts.get("input", 0) > 0,
        "has_buttons": type_counts.get("button", 0) > 0,
        "interactive_count": sum(
            type_counts.get(t, 0) for t in ["button", "input", "checkbox", "dropdown", "link", "tab"]
        ),
    }
