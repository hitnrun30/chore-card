import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity import Entity
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN

LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Chore Card sensor from a config entry."""
    entity_id = f"sensor.chore_card_{config_entry.entry_id}"  # ✅ Fix entity_id format
    LOGGER.info(f"Setting up Chore Card sensor: {entity_id}")

    sensor = ChoreCardSensor(hass, entity_id, config_entry.data)
    async_add_entities([sensor], True)

    # Store the sensor instance in hass.data
    hass.data.setdefault(DOMAIN, {})[entity_id] = sensor

    # ✅ Register service only if it doesn't exist
    if not hass.services.has_service(DOMAIN, "update"):

        @callback
        def handle_update_state(call):
            """Handle updates from the frontend."""
            entity_id = call.data.get("entity_id")
            new_state = call.data.get("state", "active")
            new_attributes = call.data.get("attributes", {})

            sensor = hass.data[DOMAIN].get(entity_id)  # ✅ Get sensor instance

            if sensor:
                # ✅ Only log updates if something actually changed
                if (
                    sensor.state != new_state
                    or sensor.extra_state_attributes != new_attributes
                ):
                    LOGGER.info(
                        f"Updating {entity_id} - State: {new_state}, Attributes: {new_attributes}"
                    )
                    sensor.async_set_state(new_state, new_attributes)
                else:
                    LOGGER.info(f"No change detected for {entity_id}, skipping update.")
            else:
                LOGGER.warning(f"Entity {entity_id} not found. Cannot update.")

        hass.services.async_register(DOMAIN, "update", handle_update_state)
        LOGGER.info("Registered service: chore_card.update")


class ChoreCardSensor(Entity):
    """Representation of a Chore Card Sensor."""

    def __init__(self, hass: HomeAssistant, entity_id: str, config_data: dict):
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
            "day_header_background_color": config_data.get(
                "day_header_background_color", "blue"
            ),
            "day_header_font_color": config_data.get("day_header_font_color", "white"),
            "current_day_background_color": config_data.get(
                "current_day_background_color", "red"
            ),
            "current_day_font_color": config_data.get(
                "current_day_font_color", "white"
            ),
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

    @property
    def unique_id(self):
        """Return a unique ID for the sensor."""
        return self.entity_id  # ✅ Ensure unique_id is valid

    @callback
    def async_set_state(self, new_state, new_attributes):
        """Properly update the sensor and notify HA only if the state changed."""
        if (
            self._attr_state != new_state
            or self._attr_extra_state_attributes != new_attributes
        ):
            self._attr_state = new_state
            self._attr_extra_state_attributes.update(new_attributes)
            self.async_write_ha_state()  # ✅ Correct async update method
            LOGGER.info(f"✅ Sensor {self.entity_id} updated: {new_state}")
        else:
            LOGGER.info(f"ℹ️ No state change for {self.entity_id}, skipping update.")
