from homeassistant.components.sensor import SensorEntity

async def async_setup_entry(hass, config_entry, async_add_entities):
    async_add_entities([ChoreCardSensor()])

class ChoreCardSensor(SensorEntity):
    def __init__(self):
        self._state = "active"
        self._attributes = {}

    @property
    def name(self):
        return "Chore Card"

    @property
    def state(self):
        return self._state

    @property
    def extra_state_attributes(self):
        return self._attributes

    def update_state(self, new_state, new_attributes):
        self._state = new_state
        self._attributes.update(new_attributes)
        self.schedule_update_ha_state()
