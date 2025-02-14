"""Chore Card Sensor for Home Assistant."""
import logging
from homeassistant.helpers.entity import Entity
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_UNKNOWN

DOMAIN = "chore_card"
LOGGER = logging.getLogger(__name__)

async def async_setup_platform(hass: HomeAssistant, config, async_add_entities, discovery_info=None):
    """Set up Chore Card sensor."""
    if discovery_info is None:
        return

    LOGGER.info("Setting up Chore Card sensor.")
    async_add_entities([ChoreCardSensor(hass)], True)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    """Set up Chore Card sensor from a config entry."""
    LOGGER.info("Setting up Chore Card sensor from entry.")
    async_add_entities([ChoreCardSensor(hass)], True)

class ChoreCardSensor(Entity):
    """Representation of a Chore Card Sensor."""

    def __init__(self, hass):
        """Initialize the sensor."""
        self.hass = hass
        self._state = STATE_UNKNOWN
        self._attributes = {}

    @property
    def name(self):
        """Return the name of the sensor."""
        return "Chore Card"

    @property
    def state(self):
        """Return the state of the sensor."""
        return self._state

    @property
    def extra_state_attributes(self):
        """Return the state attributes."""
        return self._attributes

    async def async_update(self):
        """Fetch new state data for the sensor."""
        LOGGER.info("Updating Chore Card sensor.")
        self._state = "active"
        self._attributes = {"status": "Chore tracking running"}
