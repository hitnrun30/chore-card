import logging
from homeassistant import config_entries, core
from homeassistant.components.sensor import SensorEntity
from homeassistant.core import callback

DOMAIN = "chore_card"
LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: core.HomeAssistant, entry: config_entries.ConfigEntry, async_add_entities):
    """Set up Chore Card sensor from a config entry."""
    entity_id = f"sensor.{entry.entry_id}"
    LOGGER.info(f"Setting up Chore Card sensor: {entity_id}")

    sensor = ChoreCardSensor(hass, entity_id, entry.data)
    async_add_entities([sensor], True)

    # Store the sensor instance in hass.data
    hass.data.setdefault(DOMAIN, {})[entity_id] = sensor

    # Register a service to allow frontend updates
    async def handle_update_state(call):
        """Handle updates from the frontend."""
        entity_id = call.data.get("entity_id")
        new_state = call.data.get("state", "active")
        new_attributes = call.data.get("attributes", {})

        if entity_id in hass.data[DOMAIN]:
            LOGGER.info(f"Updating {entity_id} state: {new_state}, attributes: {new_attributes}")
            hass.data[DOMAIN][entity_id].update_state(new_state, new_attributes)

    hass.services.async_register(DOMAIN, "update_state", handle_update_state)

class ChoreCardSensor(SensorEntity):
    """Representation of a Chore Card Sensor."""

    def __init__(self, hass: core.HomeAssistant, entity_id: str, config_data: dict):
        """Initialize the sensor with stored chore data."""
        self.hass = hass
        self.entity_id = entity_id
        self._attr_name = config_data.get("friendly_name", "Chore Card")
        self._attr_state = "unknown"
        self._attr_extra_state_attributes = {
            "data": config_data.get("data", {}),
            "user_points": config_data.get("user_points", {}),
            "last_reset": config_data.get("last_reset", None),
            "first_day_of_week": config_data.get("first_day_of_week", "Mon"),
            "show_long_day_names": config_data.get("show_long_day_names", False),
            "points_position": config_data.get("points_position", "top"),
            "day_header_background_color": config_data.get("day_header_background_color", "blue"),
            "day_header_font_color": config_data.get("day_header_font_color", "white"),
            "current_day_background_color": config_data.get("current_day_background_color", "red"),
            "current_day_font_color": config_data.get("current_day_font_color", "white"),
            "users": config_data.get("users", []),
        }

    @property
    def name(self):
        """Return the name of the sensor."""
        return self._attr_name

    @property
    def state(self):
        """Return the state of the sensor."""
        return self._attr_state

    @property
    def extra_state_attributes(self):
        """Return the state attributes."""
        return self._attr_extra_state_attributes

    @callback
    def update(self, new_state, new_attributes):
        """Update the sensor state and attributes."""
        self._attr_state = new_state
        self._attr_extra_state_attributes.update(new_attributes)
        self.schedule_update_ha_state()
