"""Local Helper desktop app entrypoint."""

from __future__ import annotations

import logging
import sys

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("local-helper")


def main() -> None:
    try:
        from local_helper.gui import run_gui

        run_gui()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as exc:
        logger.error("Failed to launch GUI: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
