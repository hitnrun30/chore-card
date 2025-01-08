from homeassistant.helpers.entity import Entity
from homeassistant.core import HomeAssistant
import datetime
import logging

_LOGGER = logging.getLogger(__name__)


class ChoreCardSensor(Entity):
    """A sensor to manage state for a single Chore Card."""

    def __init__(self, name: str, config: dict):
        """Initialize the Chore Card Sensor."""
        self._name = name
        self._first_day_of_week = config.get("first_day_of_week", "Monday")
        self._data = config.get("chores", {})
        self._users = config.get("users", [])
        self._state = {
            "chores": self._data,
            "users": self._users,
            "last_reset": None,
        }

    @property
    def name(self) -> str:
        """Return the name of the sensor."""
        return self._name

    @property
    def state(self) -> str:
        """Return the current state."""
        return "active" if self._state else "inactive"

    @property
    def extra_state_attributes(self) -> dict:
        """Return additional attributes for the sensor."""
        return {
            "chores": self._state["chores"],
            "users": self._state["users"],
            "last_reset": self._state["last_reset"],
        }

    async def reset_chores(self):
        """Reset weekly chores based on the first day of the week."""
        today = datetime.datetime.now().strftime("%A")
        if today != self._first_day_of_week:
            _LOGGER.debug(
                "No reset needed for card '%s' since today is not the reset day.",
                self._name,
            )
            return

        # Reset weekly chores
        if "weekly" in self._state["chores"]:
            for chore in self._state["chores"]["weekly"]:
                chore["selections"] = [None] * 7  # Clear all weekly selections

        # Update reset timestamp
        self._state["last_reset"] = datetime.datetime.now().isoformat()
        _LOGGER.info("Weekly chores reset for card '%s'.", self._name)
        self.async_write_ha_state()

    async def async_update(self):
        """Update the sensor state."""
        # Placeholder for future updates, e.g., sync with external data source
        _LOGGER.debug("Updating Chore Card Sensor: %s", self._name)
