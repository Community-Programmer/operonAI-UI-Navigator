"""Agent Loop Orchestrator — the observe→reason→act→verify cycle.

This is the main orchestration engine that ties together:
- Perception (screenshot capture → structured UIState)
- Planning (goal → step-by-step plan)
- Navigation (ADK agent with tools for UI interaction)
- Verification (goal completion detection)

Inspired by Skyvern's ForgeAgent pattern: each iteration captures the
screen state, sends it to the LLM with full context, executes returned
actions, and verifies progress.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import uuid
from datetime import datetime, timezone

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.memory import InMemoryMemoryService
from google.genai import types as genai_types

from server.connections.manager import connection_manager
from server.navigator_agent.action_schema import (
    Action,
    ActionResult,
    ActionType,
    AgentLoopState,
    LoopIteration,
    UIState,
    VerificationStatus,
    format_action_history,
    format_ui_state_for_llm,
)
from server.navigator_agent.perception import build_ui_state, get_elements_summary
from server.navigator_agent.planner import create_plan, get_current_step_context, advance_plan
from server.navigator_agent.verifier import verify_goal_completion, should_verify

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
#  Constants
# ═══════════════════════════════════════════════════════════════

MAX_ITERATIONS = 30
MAX_CONSECUTIVE_FAILURES = 3
SETTLE_DELAY = 0.5  # seconds to wait after actions for UI to settle
SCREENSHOT_TIMEOUT = 60.0
SCREENSHOT_RETRIES = 2


# ═══════════════════════════════════════════════════════════════
#  Dashboard Broadcasting Helpers
# ═══════════════════════════════════════════════════════════════

async def _broadcast_log(user_id: str, action: str, message: str, **extra):
    """Send a log event to the user's dashboards."""
    data = {"action": action, "message": message}
    data.update(extra)
    await connection_manager.broadcast_to_dashboards(user_id, {
        "type": "log",
        "data": data,
    })


async def _broadcast_status(user_id: str, message: str, device_id: str = "", **extra):
    """Send a status event to the user's dashboards."""
    data = {"message": message, "device_id": device_id}
    data.update(extra)
    await connection_manager.broadcast_to_dashboards(user_id, {
        "type": "status",
        "data": data,
    })


async def _broadcast_plan(user_id: str, plan):
    """Send the plan to the dashboard."""
    await connection_manager.broadcast_to_dashboards(user_id, {
        "type": "plan",
        "data": {
            "goal": plan.goal,
            "steps": [
                {
                    "step_number": s.step_number,
                    "description": s.description,
                    "expected_state": s.expected_state,
                    "completed": s.completed,
                }
                for s in plan.steps
            ],
            "current_step": plan.current_step,
            "reasoning": plan.reasoning,
        },
    })


async def _broadcast_verification(user_id: str, verification):
    """Send verification result to the dashboard."""
    await connection_manager.broadcast_to_dashboards(user_id, {
        "type": "verification",
        "data": {
            "status": verification.status.value,
            "reasoning": verification.reasoning,
            "progress_percent": verification.progress_percent,
            "should_continue": verification.should_continue,
        },
    })


# ═══════════════════════════════════════════════════════════════
#  Observation Phase
# ═══════════════════════════════════════════════════════════════

async def _observe(device_id: str, screen_width: int, screen_height: int) -> UIState | None:
    """Capture screenshot and build structured UIState.

    Returns None if screenshot capture fails.
    """
    for attempt in range(SCREENSHOT_RETRIES):
        try:
            result = await connection_manager.send_to_device(
                device_id,
                {"action": "screenshot", "parameters": {"segment": True}},
                timeout=SCREENSHOT_TIMEOUT,
            )

            if result.get("status") == "success":
                data = result.get("data", {})
                screenshot_b64 = data.get("screenshot", "")
                raw_elements = data.get("elements", [])

                screen_info = data.get("screen_info")
                if screen_info:
                    screen_width = screen_info.get("screen_width", screen_width)
                    screen_height = screen_info.get("screen_height", screen_height)

                if screenshot_b64:
                    ui_state = build_ui_state(
                        screenshot_b64=screenshot_b64,
                        raw_elements=raw_elements,
                        screen_width=screen_width,
                        screen_height=screen_height,
                    )
                    return ui_state

        except Exception as e:
            logger.warning("Screenshot attempt %d failed: %s", attempt + 1, e)

        if attempt < SCREENSHOT_RETRIES - 1:
            await asyncio.sleep(1.0)

    return None


# ═══════════════════════════════════════════════════════════════
#  Reasoning Phase (Build Prompt)
# ═══════════════════════════════════════════════════════════════

def _build_agent_prompt(
    iteration: int,
    goal: str,
    ui_state: UIState,
    plan,
    loop_state: AgentLoopState,
    last_verification=None,
) -> str:
    """Build the full prompt for the navigator agent.

    This combines:
    - Goal and plan context
    - Current UI state (elements list)
    - Recent action history
    - Verification feedback
    """
    parts = []

    # Plan context
    if plan and plan.steps:
        parts.append(get_current_step_context(plan))
    else:
        parts.append(f"GOAL: {goal}")

    parts.append("")

    # Screen info
    parts.append(f"Screen: {ui_state.screen_width}x{ui_state.screen_height} pixels (Windows)")
    parts.append(f"Iteration: {iteration + 1}/{MAX_ITERATIONS}")
    parts.append("")

    # Current UI state
    element_text = format_ui_state_for_llm(ui_state)
    summary = get_elements_summary(ui_state)
    parts.append(
        f"DETECTED UI ELEMENTS ({summary['total']} total, "
        f"{summary['interactive_count']} interactive):"
    )
    parts.append(element_text)
    parts.append("")

    # Action history
    if loop_state.iterations:
        parts.append("RECENT ACTION HISTORY:")
        parts.append(format_action_history(loop_state.iterations, max_recent=5))
        parts.append("")

    # Verification feedback
    if last_verification:
        parts.append(f"LAST VERIFICATION: {last_verification.status.value} "
                      f"({last_verification.progress_percent}% progress)")
        if last_verification.reasoning:
            parts.append(f"  Feedback: {last_verification.reasoning[:200]}")
        if last_verification.next_action_hint:
            parts.append(f"  Suggestion: {last_verification.next_action_hint}")
        parts.append("")

    # Instructions
    if iteration == 0:
        parts.append(
            "INSTRUCTIONS:\n"
            "1. Analyze the screenshot visually to understand the current UI state.\n"
            "2. Cross-reference with the element list — use text labels and bbox positions.\n"
            "3. Plan your approach based on the current plan step.\n"
            "4. Execute 3-5 actions toward the goal, then stop for verification.\n"
            "5. If ALL steps are truly complete and verified on screen, say TASK_COMPLETE."
        )
    else:
        parts.append(
            "Analyze: What changed since your last actions? Did they work?\n"
            "Cross-reference the annotated image with the element list to verify.\n"
            "Continue toward the goal. If ALL steps are truly complete and verified, say TASK_COMPLETE."
        )

    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════
#  Main Agent Loop
# ═══════════════════════════════════════════════════════════════

async def run_agent_loop(
    user_id: str,
    device_id: str,
    goal: str,
    runner: Runner,
    session_service,
    memory_service,
    app_name: str = "ui_navigator",
) -> AgentLoopState:
    """Execute the full observe→reason→act→verify agent loop.

    Args:
        user_id: The user who owns the device.
        device_id: The target device to control.
        goal: The navigation goal in natural language.
        runner: The ADK Runner for the navigator agent.
        session_service: ADK session service.
        memory_service: ADK memory service.
        app_name: ADK app name.

    Returns:
        The final AgentLoopState with full history.
    """
    connection_manager.active_tasks[device_id] = True
    connection_manager.interrupt_flags[device_id] = False

    loop_state = AgentLoopState(goal=goal, status="running")
    consecutive_failures = 0
    last_verification = None

    try:
        await _broadcast_status(user_id, f"Starting task: {goal}", device_id)

        # ── Get device info ─────────────────────────────────────
        info = connection_manager.device_info.get(device_id, {})
        screen_width = info.get("screen_width", 1920)
        screen_height = info.get("screen_height", 1080)
        scale_factor = info.get("scale_factor", 1.0)

        # ── Create ADK session ──────────────────────────────────
        session_id = f"nav_{device_id}_{uuid.uuid4().hex[:8]}"
        await session_service.create_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            state={
                "device_id": device_id,
                "user_id": user_id,
                "screen_width": screen_width,
                "screen_height": screen_height,
                "scale_factor": scale_factor,
                "os_name": "Windows",
                "elements": [],
            },
        )

        # ═══ Phase 0: Initial Observation ═══════════════════════
        await _broadcast_log(user_id, "status", "Capturing initial screenshot...")

        initial_ui_state = await _observe(device_id, screen_width, screen_height)

        # ═══ Phase 1: Planning ══════════════════════════════════
        await _broadcast_log(user_id, "thinking", "Creating plan...")

        plan = await create_plan(
            goal=goal,
            ui_state=initial_ui_state,
            screen_width=screen_width,
            screen_height=screen_height,
        )
        loop_state.plan = plan

        await _broadcast_plan(user_id, plan)
        logger.info("Plan: %d steps. Reasoning: %s", plan.total_steps, plan.reasoning[:100])

        # ═══ Phase 2: Execute Loop ══════════════════════════════
        for iteration in range(MAX_ITERATIONS):
            loop_state.current_iteration = iteration

            # Check for interruption
            if connection_manager.interrupt_flags.get(device_id):
                loop_state.status = "interrupted"
                await connection_manager.broadcast_to_dashboards(user_id, {
                    "type": "done",
                    "data": {"message": "Task interrupted by user", "device_id": device_id},
                })
                break

            # ── OBSERVE ─────────────────────────────────────────
            if iteration > 0:
                await asyncio.sleep(SETTLE_DELAY)

            await _broadcast_log(
                user_id, "status",
                f"Step {iteration + 1}/{MAX_ITERATIONS}: Observing screen...",
                iteration=iteration + 1,
            )

            ui_state = await _observe(device_id, screen_width, screen_height)
            if ui_state is None:
                consecutive_failures += 1
                await _broadcast_log(user_id, "warning", f"Screenshot failed (attempt {consecutive_failures})")
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    loop_state.status = "failed"
                    await _broadcast_log(user_id, "error", "Too many consecutive screenshot failures")
                    break
                continue

            consecutive_failures = 0

            # Update ADK session with current elements
            session = await session_service.get_session(
                app_name=app_name, user_id=user_id, session_id=session_id,
            )
            if session:
                # Store elements as list of dicts for the tools to use
                session.state["elements"] = [
                    {
                        "id": el.id,
                        "category": el.type.value,
                        "text": el.text,
                        "bbox": el.bbox,
                        "center_x": el.center[0] if el.center else 0,
                        "center_y": el.center[1] if el.center else 0,
                        "confidence": el.confidence,
                        "source": el.source,
                    }
                    for el in ui_state.elements
                ]
                session.state["screen_width"] = ui_state.screen_width
                session.state["screen_height"] = ui_state.screen_height

            # Broadcast screenshot to dashboard
            connection_manager.latest_screenshots[device_id] = ui_state.screenshot_b64
            await connection_manager.broadcast_to_dashboards(user_id, {
                "type": "screenshot",
                "data": {"image": ui_state.screenshot_b64},
            })

            # Create iteration record
            loop_iteration = LoopIteration(
                iteration=iteration,
                ui_state=UIState(
                    # Don't store full screenshot in history (memory)
                    elements=ui_state.elements,
                    screen_width=ui_state.screen_width,
                    screen_height=ui_state.screen_height,
                    element_count=ui_state.element_count,
                    timestamp=ui_state.timestamp,
                ),
            )

            # ── REASON + ACT ───────────────────────────────────
            prompt_text = _build_agent_prompt(
                iteration=iteration,
                goal=goal,
                ui_state=ui_state,
                plan=plan,
                loop_state=loop_state,
                last_verification=last_verification,
            )

            # Build message with screenshot image + text prompt
            parts: list[genai_types.Part] = []
            if ui_state.screenshot_b64:
                parts.append(
                    genai_types.Part(
                        inline_data=genai_types.Blob(
                            mime_type="image/jpeg",
                            data=base64.b64decode(ui_state.screenshot_b64),
                        )
                    )
                )
            parts.insert(0, genai_types.Part(text=prompt_text))

            user_message = genai_types.Content(role="user", parts=parts)

            # Run the navigator agent for one turn
            task_done = False
            agent_response_text = ""

            try:
                async for event in runner.run_async(
                    user_id=user_id,
                    session_id=session_id,
                    new_message=user_message,
                ):
                    if connection_manager.interrupt_flags.get(device_id):
                        break

                    if event.content and event.content.parts:
                        for part in event.content.parts:
                            # Thinking / reasoning
                            if getattr(part, "thought", False) and part.text and part.text.strip():
                                loop_iteration.agent_reasoning = part.text.strip()
                                await _broadcast_log(
                                    user_id, "thinking",
                                    part.text.strip(),
                                    author=event.author,
                                )
                            # Regular text response
                            elif part.text and part.text.strip():
                                agent_response_text += part.text.strip() + " "
                                await _broadcast_log(
                                    user_id, "agent_response",
                                    part.text.strip(),
                                    author=event.author,
                                )

                                # Check for explicit TASK_COMPLETE signal
                                if "TASK_COMPLETE" in part.text.upper():
                                    task_done = True

                    if event.is_final_response():
                        break

            except Exception as agent_exc:
                logger.error("Agent error on iteration %d: %s", iteration, agent_exc)
                await _broadcast_log(user_id, "warning", f"Agent error: {agent_exc}. Retrying...")
                consecutive_failures += 1
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    loop_state.status = "failed"
                    break
                await asyncio.sleep(2.0)
                continue

            # Record the iteration
            loop_state.iterations.append(loop_iteration)

            # ── VERIFY ──────────────────────────────────────────
            if task_done or should_verify(iteration, last_verification):
                await _broadcast_log(user_id, "status", "Verifying progress...")

                # Small delay to let UI settle before verification screenshot
                await asyncio.sleep(0.3)

                # Take a fresh screenshot for verification
                verify_ui = await _observe(device_id, screen_width, screen_height)
                if verify_ui is None:
                    verify_ui = ui_state

                screenshot_bytes = None
                if verify_ui.screenshot_b64:
                    try:
                        screenshot_bytes = base64.b64decode(verify_ui.screenshot_b64)
                    except Exception:
                        pass

                verification = await verify_goal_completion(
                    goal=goal,
                    ui_state=verify_ui,
                    plan=plan,
                    iterations=loop_state.iterations,
                    screenshot_bytes=screenshot_bytes,
                )

                last_verification = verification
                loop_iteration.verification = verification
                await _broadcast_verification(user_id, verification)

                # Handle verification result
                if verification.status == VerificationStatus.COMPLETE:
                    loop_state.status = "complete"
                    await connection_manager.broadcast_to_dashboards(user_id, {
                        "type": "done",
                        "data": {
                            "message": f"Task completed! {verification.reasoning}",
                            "device_id": device_id,
                            "progress": 100,
                        },
                    })
                    break

                elif verification.status == VerificationStatus.FAILED:
                    consecutive_failures += 1
                    if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                        loop_state.status = "failed"
                        await connection_manager.broadcast_to_dashboards(user_id, {
                            "type": "done",
                            "data": {
                                "message": f"Task failed: {verification.reasoning}",
                                "device_id": device_id,
                            },
                        })
                        break

                elif verification.status == VerificationStatus.NEEDS_HUMAN:
                    loop_state.status = "needs_human"
                    await connection_manager.broadcast_to_dashboards(user_id, {
                        "type": "done",
                        "data": {
                            "message": f"Human intervention needed: {verification.reasoning}",
                            "device_id": device_id,
                        },
                    })
                    break

                elif not verification.should_continue:
                    loop_state.status = "complete"
                    await connection_manager.broadcast_to_dashboards(user_id, {
                        "type": "done",
                        "data": {
                            "message": verification.reasoning,
                            "device_id": device_id,
                        },
                    })
                    break

                # Check if current plan step is complete
                if (verification.status == VerificationStatus.IN_PROGRESS and
                        plan and plan.current_step < len(plan.steps)):
                    # If progress jumped significantly, advance the plan
                    step_progress = verification.progress_percent
                    expected_per_step = 100 / max(plan.total_steps, 1)
                    completed_steps = int(step_progress / expected_per_step)
                    while plan.current_step < completed_steps and plan.current_step < len(plan.steps):
                        advance_plan(plan)
                        await connection_manager.broadcast_to_dashboards(user_id, {
                            "type": "plan_step_complete",
                            "data": {"step_number": plan.current_step},
                        })

            elif task_done:
                # Agent said TASK_COMPLETE but we already handled it above
                loop_state.status = "complete"
                await connection_manager.broadcast_to_dashboards(user_id, {
                    "type": "done",
                    "data": {"message": "Task completed", "device_id": device_id},
                })
                break

            if connection_manager.interrupt_flags.get(device_id):
                loop_state.status = "interrupted"
                break

        else:
            # Exhausted all iterations
            if loop_state.status == "running":
                loop_state.status = "max_iterations"
                await connection_manager.broadcast_to_dashboards(user_id, {
                    "type": "done",
                    "data": {
                        "message": f"Reached max iterations ({MAX_ITERATIONS})",
                        "device_id": device_id,
                    },
                })

    except Exception as e:
        logger.error("Agent loop error: %s", e, exc_info=True)
        loop_state.status = "failed"
        await connection_manager.broadcast_to_dashboards(user_id, {
            "type": "error",
            "data": {
                "message": f"Navigation error: {str(e)}",
                "device_id": device_id,
            },
        })

    finally:
        # Save session to memory
        try:
            session = await session_service.get_session(
                app_name=app_name, user_id=user_id, session_id=session_id,
            )
            if session:
                await memory_service.add_session_to_memory(session)
        except Exception as mem_err:
            logger.warning("Failed to save session to memory: %s", mem_err)

        connection_manager.active_tasks.pop(device_id, None)
        connection_manager.interrupt_flags.pop(device_id, None)

    return loop_state
