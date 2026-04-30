import asyncio
import logging
from tracker import check_all
from config import POLL_INTERVAL_MINUTES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info(f"Starting Twitter follow tracker (polling every {POLL_INTERVAL_MINUTES}m)")
    while True:
        await check_all()
        await asyncio.sleep(POLL_INTERVAL_MINUTES * 60)


if __name__ == "__main__":
    asyncio.run(main())
