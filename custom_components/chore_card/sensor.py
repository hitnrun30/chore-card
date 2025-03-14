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
    entity_id = config_entry.data["sensor_name"]  # ✅ Ensure entity ID comes from config entry
    LOGGER.info(f"Setting up Chore Card sensor: {entity_id}")

    # Check if this is a rename operation by looking for an existing entity with the same ID
    existing_entity = next(
        (
            entity
            for entity in hass.data[DOMAIN].values()
            if entity.entity_id == f"sensor.{config_entry.data['previous_sensor_name']}"
        ),
        None,
    )

    # Create a new sensor with the new entity ID
    sensor = ChoreCardSensor(hass, config_entry)

    # If renaming, copy over attributes and remove the old entity
    if existing_entity:
        sensor._attr_state = existing_entity.state
        sensor._attr_extra_state_attributes = existing_entity.extra_state_attributes

        LOGGER.info(
            f"🔄 Renaming Chore Card sensor from {existing_entity.entity_id} → {sensor.entity_id}"
        )

        # Remove old entity
        hass.states.async_remove(existing_entity.entity_id)
        del hass.data[DOMAIN][existing_entity.entity_id]

    # Add the new sensor
    async_add_entities([sensor], True)

    # ✅ Ensure DOMAIN exists in hass.data
    hass.data.setdefault(DOMAIN, {})[entity_id] = sensor
    LOGGER.info(f"✅ Stored sensor in hass.data: {entity_id}")

    LOGGER.info(f"✅ Storing sensor {entity_id} in hass.data[DOMAIN]")
    hass.data[DOMAIN][entity_id] = sensor  # ✅ Store sensor properly
    LOGGER.info(f"📌 Stored sensors in hass.data[DOMAIN]: {list(hass.data[DOMAIN].keys())}")

    # ✅ Register service only if it doesn't exist
    if not hass.services.has_service(DOMAIN, "update"):

        @callback
        def handle_update_state(call):
            """Handle updates from the frontend."""
            entity_id = call.data.get("entity_id")
            new_state = call.data.get("state", "active")
            new_attributes = call.data.get("attributes", {})

            LOGGER.info(f"🛠️ Received service call for {entity_id}")

            stored_sensors = hass.data.get(DOMAIN, {})
            LOGGER.info(f"📌 Currently stored sensors: {list(stored_sensors.keys())}")

            sensor = stored_sensors.get(entity_id)

            if sensor:
                if sensor.state != new_state or sensor.extra_state_attributes != new_attributes:
                    LOGGER.info(
                        f"🔄 Updating {entity_id} - State: {new_state}, Attributes: {new_attributes}"
                    )
                    sensor.async_set_state(new_state, new_attributes)
                else:
                    LOGGER.info(f"✅ No change detected for {entity_id}, skipping update.")
            else:
                LOGGER.warning(f"⚠️ Entity {entity_id} not found in hass.data. Cannot update.")

        hass.services.async_register(DOMAIN, "update", handle_update_state)
        LOGGER.info("✅ Registered service: chore_card.update")

class ChoreCardSensor(Entity):
    """Representation of a Chore Card Sensor."""

    def __init__(self, hass: HomeAssistant, config_entry: ConfigEntry):
        """Initialize the sensor with stored chore data."""
        self.hass = hass
        self.entity_id = config_entry.data["sensor_name"]  # ✅ Set entity_id from user input
        self._attr_name = config_entry.title  # ✅ Use user input for friendly name
        self._attr_state = "unknown"
        self._attr_extra_state_attributes = {
            "data": config_entry.data.get("data", {}),
            "user_points": config_entry.data.get("user_points", {}),
            "last_reset": config_entry.data.get("last_reset", None),
            "first_day_of_week": config_entry.data.get("first_day_of_week", "Mon"),
            "show_long_day_names": config_entry.data.get("show_long_day_names", False),
            "points_position": config_entry.data.get("points_position", "top"),
            "day_header_background_color": config_entry.data.get("day_header_background_color", "blue"),
            "day_header_font_color": config_entry.data.get("day_header_font_color", "white"),
            "current_day_background_color": config_entry.data.get("current_day_background_color", "red"),
            "current_day_font_color": config_entry.data.get("current_day_font_color", "white"),
            "users": config_entry.data.get("users", []),
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
