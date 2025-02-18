"""Chore Card Sensor for Home Assistant."""
import logging
from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity_platform import AddEntitiesCallback

DOMAIN = "chore_card"
LOGGER = logging.getLogger(__name__)

async def async_setup_platform(hass: HomeAssistant, config, async_add_entities, discovery_info=None):
    """Set up Chore Card sensor from YAML."""
    if discovery_info is None:
        return

    LOGGER.info("Setting up Chore Card sensor from YAML.")
    async_add_entities([ChoreCardSensor(hass, "chore_card_default")], True)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback):
    """Set up Chore Card sensor from a config entry."""
    LOGGER.info("Setting up Chore Card sensor from entry.")

    entity_id = "sensor.chore_card_default"
    sensor = ChoreCardSensor(hass, entity_id)

    async_add_entities([sensor], True)

    # Store sensor reference for service calls
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entity_id] = sensor

    async def update_state_service(call):
        """Handle the service call to update the sensor state."""
        entity_id = call.data.get("entity_id", "sensor.chore_card_default")
        new_state = call.data.get("state", "active")
        new_attributes = call.data.get("attributes", {})

        if entity_id in hass.data[DOMAIN]:
            sensor = hass.data[DOMAIN][entity_id]
            sensor.update_state(new_state, new_attributes)
            LOGGER.info(f"Updated state for {entity_id}")
        else:
            LOGGER.warning(f"Chore Card sensor '{entity_id}' not found.")

    hass.services.async_register(DOMAIN, "update_state", update_state_service)

class ChoreCardSensor(SensorEntity):
    """Representation of a Chore Card Sensor."""

    def __init__(self, hass, entity_id):
        """Initialize the sensor."""
        self.hass = hass
        self.entity_id = entity_id
        self._state = "active"
        self._attributes = {
            "status": "Chore tracking running",
            "data": {},
            "user_points": {},
            "last_reset": None,
        }

    @property
    def name(self):
        """Return the name of the sensor."""
        return "Chore Card"

    @property
    def unique_id(self):
        """Return a unique ID for the sensor."""
        return self.entity_id

    @property
    def state(self):
        """Return the state of the sensor."""
        return self._state

    @property
    def extra_state_attributes(self):
        """Return additional attributes of the sensor."""
        return self._attributes

    async def async_update(self):
        """Fetch new state data for the sensor."""
        LOGGER.info(f"Updating Chore Card sensor: {self.entity_id}")

    @callback
    def update_state(self, new_state, new_attributes):
        """Update the sensor state and attributes."""
        self._state = new_state
        self._attributes.update(new_attributes)
        self.schedule_update_ha_state()
        LOGGER.info(f"Chore Card sensor {self.entity_id} updated: {self._state}")
