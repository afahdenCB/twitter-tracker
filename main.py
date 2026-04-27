import logging
import schedule
import time
from tracker import check_all
from config import POLL_INTERVAL_MINUTES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    logger.info(f"Starting Twitter follow tracker (polling every {POLL_INTERVAL_MINUTES}m)")
    check_all()
    schedule.every(POLL_INTERVAL_MINUTES).minutes.do(check_all)
    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
