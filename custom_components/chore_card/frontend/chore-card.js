const BASE_PATH = "/hacsfiles/chore-card/";

export class ChoreCard extends HTMLElement {
  constructor() {
      super();
      console.log("Chore Card created");
      
      this.attachShadow({ mode: "open" });

      this.fetchVersionFromHA(); // ✅ Fetch version from Home Assistant

      this.lastChoreCardId = null; // ✅ Track last known chore_card_id

      // Default values for the card configuration
      this.firstDayOfWeek = "Mon"; // Default: Monday
      this.showLongDayNames = false; // Default: short day names
      this.pointsPosition = "top"; // Default: points displayed at the top
      this.dayHeaderBackgroundColor = "blue"; // Default: blue background
      this.dayHeaderFontColor = "white"; // Default: white text
      this.currentDayBackgroundColor = "red";
      this.currentDayFontColor = "white";

      // Default values for other state-related properties
      this.data = {}; // Default: no chore data
      this.users = []; // Default: no users
      this.userPoints = {}; // Default: no points tracked
      this.lastReset = null; // Default: no reset date
      this.lastSavedState = null; // Default: no saved state loaded
      this.initialized = false; // Initialize as false

      // Placeholder for Home Assistant token
      this.haToken = null; // Default to null until hass is set

      // Dynamically resolve paths
      this.cssPath = `${BASE_PATH}chore-card.css`;

      // Initialize the card state and render
      this.initializeCard().catch((error) =>
          console.error("Error initializing ChoreCard:", error),
      );
  }

  async fetchVersionFromHA() {
    try {
        if (window.hass) {
            const response = await window.hass.callWS({ type: "config/get" });
            this.version = response.version || "Unknown";
            console.log(`Chore Card Loaded - Version: ${this.version}`);
        } else {
            console.warn("Home Assistant instance not available.");
            this.version = "Unknown";
        }
    } catch (error) {
        console.error("Error fetching Chore Card version:", error);
        this.version = "Unknown";
    }
  }

  /**
   * Function to ensure chore_card_id is set and updated in Lovelace YAML
   */
  initializeCardId(config) {
    if (!config.chore_card_id) {
      // Check localStorage for an existing ID
      let storedCardId = localStorage.getItem("chore-card-id");

      // If missing or invalid, generate a new one
      if (!storedCardId || storedCardId === "undefined" || storedCardId === "null") {
        storedCardId = `chore-card-${Date.now()}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");
        localStorage.setItem("chore-card-id", storedCardId);
      }

      console.log(`Generated new chore_card_id: ${storedCardId}`);
      this.cardId = storedCardId;

      // Update Lovelace YAML with the new ID
      let updatedConfig = Object.assign({}, config, { chore_card_id: storedCardId });
      this._updateCardConfig(updatedConfig);
    } else {
      // If chore_card_id exists in YAML, use it
      this.cardId = config.chore_card_id;
      localStorage.setItem("chore-card-id", this.cardId);
      console.log(`Using stored cardId from YAML: ${this.cardId}`);
    }
  }

  /**
   * Function to update Lovelace YAML dynamically
   */
  _updateCardConfig(newConfig) {
    const event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(event);
  }

  async initializeCard() {
    console.log("Initializing Chore Card...");
    const yamlData = this.config || {};
    console.log("YAML data:", yamlData);

    if (this._hass) {
      await this.loadStateFromSensor(yamlData);
    } else {
      console.warn("Home Assistant instance not available; skipping state loading.");
    }

    this.checkForReset();
    this.render();
  }

  setConfig(config) {
    if (!config || !config.type) {
      throw new Error("Invalid card configuration");
    }

    this.config = config;

    // Ensure card ID is set and saved
    this.initializeCardId(config);

    // Set configuration options with defaults
    this.firstDayOfWeek = config.first_day_of_week || "Mon";
    this.showLongDayNames = config.show_long_day_names || false;
    this.pointsPosition = config.points_position || "top";
    this.dayHeaderBackgroundColor =
      config.day_header_background_color || "blue";
    this.dayHeaderFontColor = config.day_header_font_color || "white";
    this.currentDayBackgroundColor =
      config.current_day_background_color || "red";
    this.currentDayFontColor = config.current_day_font_color || "white";

    console.log("Configuration set:", this.config);

    // Render the card after applying the config
    this.render();
  }

  getCardSize() {
    // Return an estimate of the card's height in rows
    return 5; // Adjust based on your card's layout
  }

  // Add the CSS file to the shadowRoot
  attachStyles() {
    const link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = this.cssPath;
    this.shadowRoot.appendChild(link);
  }

  set hass(hass) {
    this._hass = hass;

    if (!this.initialized && hass) {
        try {
            // ✅ Retrieve Home Assistant authentication token
            this.haToken = hass.auth?.data?.access_token || null;

            if (this.haToken) {
                console.log("Successfully retrieved Home Assistant token.");
            } else {
                console.warn("Home Assistant token is not available.");
            }

            // ✅ Determine the API base URL
            this.apiBaseUrl = hass.auth?.data?.hassUrl || "";
            if (this.apiBaseUrl) {
                console.log("Using API base URL:", this.apiBaseUrl);
            } else {
                console.warn("API base URL is not available.");
            }

            // ✅ Initialize card state from HA sensor (Avoid duplicating logic)
            this.loadStateFromSensor();

            this.initialized = true;
        } catch (error) {
            console.error("Error retrieving Home Assistant token or base URL:", error);
        }
    }

    if (!this.config) {
        return;
    }

    if (this.config.entity) {
        this.entity = hass.states[this.config.entity];
    }

    this.render();
    this.checkAndRegisterChoreCard(); // ✅ Ensure ID is registered only when necessary
  }

  
  get hass() {
    return this._hass;
  }

  async checkAndRegisterChoreCard() {
      if (!this.hass || !this.config || !this.config.chore_card_id) {
          return;
      }

      const newChoreCardId = `sensor.${this.config.chore_card_id}`;

      if (this.lastChoreCardId && this.lastChoreCardId !== newChoreCardId) {
          await this.deleteChoreCardEntity(this.lastChoreCardId);
      }

      this.lastChoreCardId = newChoreCardId;
      await this.registerChoreCardEntity(newChoreCardId);
  }

  async registerChoreCardEntity(entityId) {
      try {
          const states = await this.hass.callWS({ type: "get_states" });
          const entityExists = states.some(state => state.entity_id === entityId);

          if (!entityExists) {
              await this.hass.callService("chore_card", "create", { entity_id: entityId });
              console.log(`Chore Card Entity Registered: ${entityId}`);
          }
      } catch (error) {
          console.error("Error registering Chore Card entity:", error);
      }
  }

  async deleteChoreCardEntity(entityId) {
      try {
          const states = await this.hass.callWS({ type: "get_states" });
          const entityExists = states.some(state => state.entity_id === entityId);

          if (entityExists) {
              await this.hass.callService("chore_card", "delete", { entity_id: entityId });
              console.log(`Chore Card Entity Deleted: ${entityId}`);
          }
      } catch (error) {
          console.error("Error deleting Chore Card entity:", error);
      }
  }

  createDefaultState(yamlData) {
    console.log("Creating default state...");

    // Set constructor variables directly from YAML or fallback to defaults
    this.firstDayOfWeek = yamlData.first_day_of_week
      ? this.normalizeDayName(yamlData.first_day_of_week)
      : "Mon";
    this.showLongDayNames = yamlData.show_long_day_names || false;
    this.pointsPosition = yamlData.points_position || "bottom";
    this.dayHeaderBackgroundColor =
      yamlData.day_header_background_color || "blue";
    this.dayHeaderFontColor = yamlData.day_header_font_color || "white";
    this.currentDayBackgroundColor =
      yamlData.current_day_background_color || "red";
    this.currentDayFontColor = yamlData.current_day_font_color || "white";

    this.users = yamlData.users || []; // Default to empty array
    this.data = JSON.parse(JSON.stringify(yamlData.chores || {})); // Deep copy to make mutable

    // Normalize `days` for weekly chores
    if (this.data.weekly) {
      this.data.weekly = this.data.weekly.map((chore) => {
        return {
          ...chore, // Clone the chore to avoid modifying frozen objects
          days:
            typeof chore.days === "string"
              ? chore.days
                  .split(",")
                  .map((day) => this.normalizeDayName(day.trim()))
              : Array.isArray(chore.days)
                ? chore.days.map((day) => this.normalizeDayName(day.trim()))
                : [],
        };
      });
    }

    // Construct and return the default state object
    const defaultState = {
      cardId: this.cardId,
      firstDayOfWeek: this.firstDayOfWeek,
      showLongDayNames: this.showLongDayNames,
      pointsPosition: this.pointsPosition,
      dayHeaderBackgroundColor: this.dayHeaderBackgroundColor,
      dayHeaderFontColor: this.dayHeaderFontColor,
      currentDayBackgroundColor: this.currentDayBackgroundColor,
      currentDayFontColor: this.currentDayFontColor,
      lastReset: this.lastReset || null,
      users: this.users,
      userPoints: {},
      data: this.data,
    };

    console.log("Default state created:", defaultState);
    return defaultState;
  }

  async loadStateFromSensor(yamlData) {
    if (!this._hass) {
      console.warn("Home Assistant instance not available.");
      return;
    }

    const sensorState = this._hass.states[`sensor.${this.cardId}`];
    if (sensorState && sensorState.attributes) {
      console.log("Loaded state from Home Assistant sensor:", sensorState);
      this.lastSavedState = sensorState.attributes;
    } else {
      console.warn("No saved state found, creating default.");
      this.lastSavedState = this.createDefaultState(yamlData);
      this.saveStateToHomeAssistant(); // Save default state
    }
  }


  async saveStateToHomeAssistant() {
    if (!this._hass) {
        console.warn("Home Assistant instance not available.");
        return;
    }

    const entityId = `sensor.${this.cardId}`;
    const currentState = this._hass.states[entityId]?.attributes;
    
    const newState = {
        cardId: this.cardId,
        data: this.data || {}, // Chore data
        userPoints: this.userPoints || {}, // User points
        lastReset: this.lastReset || null, // Last reset date
        firstDayOfWeek: this.firstDayOfWeek, // Option
        showLongDayNames: this.showLongDayNames, // Option
        pointsPosition: this.pointsPosition, // Option
        dayHeaderBackgroundColor: this.dayHeaderBackgroundColor, // Option
        dayHeaderFontColor: this.dayHeaderFontColor, // Option
        currentDayBackgroundColor: this.currentDayBackgroundColor,
        currentDayFontColor: this.currentDayFontColor,
        users: this.users || [], // Users
    };

    // ✅ Avoid unnecessary updates if state hasn't changed
    if (JSON.stringify(currentState) === JSON.stringify(newState)) {
        console.log("No changes detected, skipping state save.");
        return;
    }

    try {
        console.log("Saving updated Chore Card state:", newState);
        
        await this._hass.callService("chore_card", "update", {
            entity_id: entityId,
            attributes: newState,
        });

        console.log(`✅ Successfully saved state for: ${entityId}`);
    } catch (error) {
        console.error(`❌ Failed to save Chore Card state: ${error}`);
    }
}



  checkAndUpdateOptions(yamlData, savedState) {
    console.log("Checking and updating options...");
    const stateOptions = [
      { yamlKey: "first_day_of_week", stateKey: "firstDayOfWeek" },
      { yamlKey: "show_long_day_names", stateKey: "showLongDayNames" },
      { yamlKey: "points_position", stateKey: "pointsPosition" },
      {
        yamlKey: "day_header_background_color",
        stateKey: "dayHeaderBackgroundColor",
      },
      { yamlKey: "day_header_font_color", stateKey: "dayHeaderFontColor" },
      {
        yamlKey: "current_day_background_color",
        stateKey: "currentDayBackgroundColor",
      },
      { yamlKey: "current_day_font_color", stateKey: "currentDayFontColor" },
    ];

    let optionsChanged = false;

    console.log("Saved state before update:", savedState);

    // Ensure savedState is initialized and has a valid structure
    if (!savedState || typeof savedState !== "object") {
      savedState = {}; // Initialize it as an empty object
    }

    console.log("Saved state after update:", savedState);

    stateOptions.forEach(({ yamlKey, stateKey }) => {
        let yamlValue = yamlData[yamlKey] !== undefined ? yamlData[yamlKey] : savedState[stateKey];
        let savedValue = savedState[stateKey];

        // Normalize `first_day_of_week`
        if (stateKey === "firstDayOfWeek") {
            yamlValue = yamlValue ? this.normalizeDayName(yamlValue) : "Mon";
            savedValue = savedValue ? this.normalizeDayName(savedValue) : "Mon";
        }

        // Validate CSS colors for day header and font
        if (
            (stateKey === "dayHeaderBackgroundColor" || stateKey === "dayHeaderFontColor") &&
            yamlValue !== undefined &&
            !this.isValidCssColor(yamlValue)
        ) {
            console.warn(`Invalid CSS color for ${stateKey}: ${yamlValue}. Falling back to default.`);
            yamlValue = stateKey === "dayHeaderBackgroundColor" ? "blue" : "white"; // Defaults
        }

        // Validate CSS colors for current day
        if (
            (stateKey === "currentDayBackgroundColor" || stateKey === "currentDayFontColor") &&
            yamlValue !== undefined &&
            !this.isValidCssColor(yamlValue)
        ) {
            console.warn(`Invalid CSS color for ${stateKey}: ${yamlValue}. Falling back to default.`);
            yamlValue = stateKey === "currentDayBackgroundColor" ? "red" : "white"; // Defaults
        }

        // Only update if YAML provided a value different from the saved state
        if (yamlValue !== undefined && yamlValue !== savedValue) {
            console.log(`Option changed: ${stateKey} from ${savedValue} to ${yamlValue}`);
            savedState[stateKey] = yamlValue; // Update the saved state with the YAML value
            optionsChanged = true;
        }

        // Always update the constructor variables, but only if YAML provides a value
        if (yamlValue !== undefined) {
            this[stateKey] = yamlValue;
        }
    });


    console.log(
      "Options updated:",
      this.firstDayOfWeek,
      this.showLongDayNames,
      this.pointsPosition,
      this.dayHeaderBackgroundColor,
      this.dayHeaderFontColor,
      this.currentDayBackgroundColor,
      this.currentDayFontColor,
    );

    return optionsChanged;
  }

  checkAndUpdateUsers(yamlData, savedState) {
    console.log("Checking and updating users...");

    const yamlUsers = yamlData.users || [];
    const savedUsers = savedState.users || [];
    const yamlUserMap = new Map(yamlUsers.map((user) => [user.name, user]));
    const savedUserMap = new Map(savedUsers.map((user) => [user.name, user]));

    let usersChanged = false;

    // Handle removed users
    for (let i = savedUsers.length - 1; i >= 0; i--) {
      const savedUser = savedUsers[i];
      if (!yamlUserMap.has(savedUser.name)) {
        console.log(`User removed: ${savedUser.name}`);
        savedUsers.splice(i, 1); // Remove user from savedUsers
        delete savedState.userPoints[savedUser.name]; // Remove points for this user

        // Clear associations in the chore grid
        Object.values(savedState.data).forEach((choreList) => {
          choreList.forEach((chore) => {
            if (chore.selections) {
              chore.selections = chore.selections.map((selection) =>
                selection === savedUser.name ? null : selection,
              );
            }
          });
        });

        usersChanged = true;
      }
    }

    // Handle added or updated users
    yamlUsers.forEach((yamlUser) => {
      const savedUser = savedUserMap.get(yamlUser.name);

      const validatedColor = this.isValidCssColor(yamlUser.background_color)
        ? yamlUser.background_color
        : "transparent";

      const validatedFont = this.isValidCssColor(yamlUser.font_color)
        ? yamlUser.font_color
        : "white";

      if (!savedUser) {
        console.log(`Adding new user: ${yamlUser.name}`);
        savedUsers.push({
          name: yamlUser.name,
          background_color: validatedColor,
          font_color: validatedFont,
        });
        savedState.userPoints[yamlUser.name] = 0; // Initialize points for new user
        usersChanged = true;
      } else if (
        savedUser.background_color !== validatedColor ||
        savedUser.font_color != validatedFont
      ) {
        console.log(`Updating color for user: ${yamlUser.name}`);
        const updatedUser = {
          ...savedUser, // Clone existing user properties
          background_color: validatedColor,
          font_color: validatedFont
        };

        // Find and replace the user in savedUsers
        const userIndex = savedUsers.findIndex(user => user.name === yamlUser.name);
        if (userIndex !== -1) {
          savedUsers[userIndex] = updatedUser; // Replace the frozen object
        }
        usersChanged = true;
      }
    });

    // Ensure the saved state and constructor values are synchronized
    if (usersChanged || !this.users.length) {
      console.log("Applying updated users to constructor...");
      this.users = [...savedUsers]; // Update the constructor's users
      savedState.users = [...savedUsers]; // Sync savedState users
      this.userPoints = { ...savedState.userPoints }; // Sync points
    }

    console.log("Users updated:", this.users);
    return usersChanged;
  }

  checkAndUpdateChores(yamlData, savedState) {
    console.log("Checking and updating chores...");
    
    // If this.data is frozen, create a mutable copy
    if (Object.isFrozen(this.data)) {
        this.data = JSON.parse(JSON.stringify(this.data));
        console.log("Created a mutable copy of this.data:", this.data);
    }

    const choreSections = ["daily", "weekly", "monthly"];
    let choresChanged = false;

    // Ensure savedState.data exists and is mutable
    savedState.data = savedState.data ? JSON.parse(JSON.stringify(savedState.data)) : {};

    choreSections.forEach((section) => {
        const yamlChores = yamlData.chores?.[section] || [];
        savedState.data[section] = savedState.data[section] || []; // Ensure section exists
        const savedChores = [...savedState.data[section]];

        const yamlChoreMap = new Map(
            yamlChores.map((chore) => [chore.name, chore]),
        );
        const savedChoreMap = new Map(
            savedChores.map((chore) => [chore.name, chore]),
        );

        const updatedChores = [];

        yamlChores.forEach((yamlChore) => {
            const savedChore = savedChoreMap.get(yamlChore.name);

            if (!savedChore) {
                updatedChores.push({ ...yamlChore, selections: Array(7).fill(null) });
                choresChanged = true;
            } else {
                let choreUpdated = false;

                // Check and update points
                if (yamlChore.points !== savedChore.points) {
                    console.log(`Updating points for chore: ${yamlChore.name}`);
                    savedChore.selections?.forEach((user) => {
                        if (user) {
                            savedState.userPoints[user] +=
                                (yamlChore.points || 0) - (savedChore.points || 0);
                        }
                    });
                    savedChore.points = yamlChore.points;
                    choreUpdated = true;
                }

                // Normalize and check `days` for weekly chores
                if (section === "weekly") {
                    const normalizedDays =
                        typeof yamlChore.days === "string"
                            ? yamlChore.days
                                  .split(",")
                                  .map((day) => this.normalizeDayName(day.trim()))
                            : Array.isArray(yamlChore.days)
                            ? yamlChore.days.map((day) =>
                                  this.normalizeDayName(day.trim()),
                              )
                            : [];
                    if (
                        JSON.stringify(normalizedDays) !== JSON.stringify(savedChore.days)
                    ) {
                        console.log(
                            `Updating days for weekly chore: ${yamlChore.name} to ${normalizedDays}`,
                        );
                        savedChore.days = normalizedDays;
                        savedChore.selections = Array(7).fill(null); // Reset selections
                        choreUpdated = true;
                    }
                }

                // Monthly-specific updates
                if (section === "monthly") {
                    if (
                        yamlChore.week_of_month?.week !== savedChore.week_of_month?.week
                    ) {
                        console.log(
                            `Week of month changed for monthly chore: ${yamlChore.name}`,
                        );
                        savedChore.selections = Array(7).fill(null);
                        savedChore.week_of_month = { ...yamlChore.week_of_month };
                        choreUpdated = true;
                    }
                    if (yamlChore.max_days !== savedChore.max_days) {
                        console.log(
                            `Max days changed for monthly chore: ${yamlChore.name}`,
                        );
                        if ((yamlChore.max_days || 0) < (savedChore.max_days || 0)) {
                            savedChore.selections = Array(7).fill(null);
                        }
                        savedChore.max_days = yamlChore.max_days;
                        choreUpdated = true;
                    }
                    if (
                        yamlChore.week_of_month?.highlight_color !==
                        savedChore.week_of_month?.highlight_color
                    ) {
                        const validatedHighlightColor = this.isValidCssColor(
                            yamlChore.week_of_month.highlight_color,
                        )
                            ? yamlChore.week_of_month.highlight_color
                            : "transparent";
                        console.log(
                            `Highlight color changed for monthly chore: ${yamlChore.name} to ${validatedHighlightColor}`,
                        );
                        savedChore.week_of_month.highlight_color =
                            validatedHighlightColor;
                        choreUpdated = true;
                    }
                }

                if (choreUpdated) {
                    choresChanged = true;
                }
                updatedChores.push(savedChore);
            }
        });

        savedState.data[section] = updatedChores;

        // Safely update `this.data`
        this.data[section] = updatedChores;
    });

    console.log("Chores updated:", this.data);
    return choresChanged;
  }

  normalizeDayName(dayName) {
    if (!dayName || typeof dayName !== "string") {
        console.warn("Invalid day name:", dayName);
        return undefined;
    }

    const dayMap = {
        sun: "Sun",
        mon: "Mon",
        tue: "Tue",
        wed: "Wed",
        thu: "Thu",
        fri: "Fri",
        sat: "Sat",
        sunday: "Sun",
        monday: "Mon",
        tuesday: "Tue",
        wednesday: "Wed",
        thursday: "Thu",
        friday: "Fri",
        saturday: "Sat",
    };

    const normalizedDay = dayMap[dayName.toLowerCase()];
    if (!normalizedDay) {
        console.warn(`Invalid day name: ${dayName}`);
        return undefined;
    }

    return normalizedDay;
}

  isValidCssColor(color) {
    const s = new Option().style;
    s.color = color;
    return s.color !== "";
  }

  getOrderedDayIndexes() {
    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const longDays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    // Find the starting index based on `firstDayOfWeek`
    const startIndex =
      shortDays.indexOf(this.firstDayOfWeek) !== -1
        ? shortDays.indexOf(this.firstDayOfWeek)
        : longDays.indexOf(this.firstDayOfWeek);

    if (startIndex === -1) {
      console.error("Invalid first_day_of_week:", this.firstDayOfWeek);
      return null;
    }

    // Return ordered indexes starting from `firstDayOfWeek`
    const orderedIndexes = [...Array(7).keys()].map(
      (i) => (startIndex + i) % 7,
    );
    return orderedIndexes;
  }

  getDayIndex(dayName) {
    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const longDays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const lowerDay = dayName.toLowerCase();

    const shortIndex = shortDays.findIndex(
      (day) => day.toLowerCase() === lowerDay,
    );
    const longIndex = longDays.findIndex(
      (day) => day.toLowerCase() === lowerDay,
    );

    if (shortIndex !== -1) return shortIndex;
    if (longIndex !== -1) return longIndex;

    console.error(`Invalid day name: ${dayName}`);
    return -1; // Return -1 if day name is invalid
  }

  async checkForReset() {
    const today = new Date();
    const todayDateString = today.toISOString().split("T")[0]; // Current date as a string
    const firstDayOfWeekIndex = this.getDayIndex(this.firstDayOfWeek);
    const todayIndex = today.getDay();

    // Only reset on the first day of the week
    if (todayIndex === firstDayOfWeekIndex) {
      if (!this.lastReset || this.lastReset !== todayDateString) {
        console.log(`Resetting chores for card: ${this.cardId}`);
        await this.resetWeeklyChores(); // Reset weekly chores
        this.lastReset = todayDateString; // Update last reset date
      } else {
        console.log("Already reset for today. No action taken.");
      }
    } else {
      console.log(
        `Not the first day of the week (${this.firstDayOfWeek}). No reset needed.`,
      );
    }
  }

  async resetWeeklyChores() {
    console.log("Requesting manual chore reset...");

    if (!this._hass) {
        console.warn("Home Assistant instance not available.");
        return;
    }

    try {
        // Step 1: Call Home Assistant service to reset the sensor
        await this._hass.callService("chore_card", "reset_weekly_chores", {
            entity_id: `sensor.${this.cardId}`
        });

        console.log("Chore reset request sent to Home Assistant.");

        // Step 2: Clear selections in the frontend as well (optional but recommended)
        ["daily", "weekly", "monthly"].forEach((section) => {
            if (this.data[section]) {
                this.data[section].forEach((chore) => {
                    chore.selections = Array(7).fill(null); // Reset selections
                });
            }
        });

        // Step 3: Reset user points locally
        Object.keys(this.userPoints).forEach((user) => {
            this.userPoints[user] = 0;
        });

        // Step 4: Update last reset timestamp
        this.lastReset = new Date().toISOString();

        // Step 5: Save updated state to Home Assistant
        await this.saveStateToHomeAssistant();

        // Step 6: Re-render UI
        console.log("Re-rendering card after reset.");
        this.render();
    } catch (error) {
        console.error("Error resetting weekly chores:", error);
    }
  }


  render() {
    // Clear the existing content
    this.shadowRoot.innerHTML = "";

    // Attach styles dynamically
    this.attachStyles();

    // Prepare the grid content
    const scorecard = this.renderScorecard();
    const isScoreAtTop = this.pointsPosition === "top";
    const isScoreAtBottom = this.pointsPosition === "bottom";

    const gridContent = `
      <div class="card">
        <!-- Fixed Top Section -->
        <div class="sticky-top-container">
          ${isScoreAtTop ? `<div id="top-scorecard" class="scorecard">${scorecard}</div>` : ""}
          <div class="day-headers">
            ${this.renderWeekDays()} <!-- Day headers stay fixed -->
          </div>
        </div>

        <!-- Scrollable Grid Container -->
        <div class="grid-container">
          <div class="grid">
            <div class="empty-row"></div>
            ${this.data.daily ? this.renderChoreGrid("Daily Chores", this.data.daily, "daily") : ""}
            ${this.data.weekly ? this.renderChoreGrid("Weekly Chores", this.data.weekly, "weekly") : ""}
            ${this.data.monthly ? this.renderChoreGrid("Monthly Chores", this.data.monthly, "monthly") : ""}
          </div>
        </div>

        <!-- Fixed Bottom Section (Scorecard at Bottom) -->
        <div class="sticky-bottom-container ${isScoreAtBottom ? "show" : ""}">
          ${isScoreAtBottom ? `<div id="bottom-scorecard" class="scorecard">${scorecard}</div>` : ""}
        </div>
      </div>
    `;

    // Create a container for proper width handling
    const container = document.createElement("div");
    container.classList.add("container");
    container.innerHTML = gridContent;

    // Append the container to the shadow DOM
    this.shadowRoot.appendChild(container);
  }

  renderWeekDays() {
    const orderedIndexes = this.getOrderedDayIndexes();
    if (!orderedIndexes) {
        return '<div class="day-header">Invalid Week Start</div>';
    }

    const daysOfWeek = this.showLongDayNames
        ? [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
          ]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const currentDayIndex = new Date().getDay(); // Get current day index (0 = Sunday, 1 = Monday, etc.)

    const dayHeaders = orderedIndexes.map((index) => {
        const isCurrentDay = index === currentDayIndex;

        // Determine styles based on whether it's the current day
        const backgroundColor = isCurrentDay
            ? this.currentDayBackgroundColor
            : this.dayHeaderBackgroundColor;

        const fontColor = isCurrentDay
            ? this.currentDayFontColor
            : this.dayHeaderFontColor;

        return `
            <div 
                class="day-header" 
                style="background-color: ${backgroundColor}; color: ${fontColor};">
                ${daysOfWeek[index]}
            </div>
        `;
    });

    // Add a transparent placeholder column at the start
    dayHeaders.unshift(
        `<div class="day-header empty"></div>`
    );

    return dayHeaders.join("");
  }

  renderChoreGrid(header, chores, section) {
    if (!chores || chores.length === 0) return "";

    switch (section) {
      case "daily":
        return this.renderDailyChores(header, chores);
      case "weekly":
        return this.renderWeeklyChores(header, chores);
      case "monthly":
        return this.renderMonthlyChores(header, chores);
      default:
        console.error(`Unknown section: ${section}`);
        return "";
    }
  }

  renderDailyChores(header, chores) {
    const orderedIndexes = this.getOrderedDayIndexes();
    if (!orderedIndexes) return "";

    let html = `<div class="section-header">${header}</div>`;

    html += chores
      .map((chore, rowIndex) =>
        this.renderChoreRow(
          chore,
          rowIndex,
          "daily",
          orderedIndexes,
          () => false, // Daily chores have no disabling logic
        ),
      )
      .join("");

    return html;
  }

  renderWeeklyChores(header, chores) {
    const orderedIndexes = this.getOrderedDayIndexes();
    if (!orderedIndexes) {
      console.warn("Ordered indexes not found.");
      return "";
    }
    
    let html = `<div class="section-header">${header}</div>`;

    html += chores
      .map((chore, rowIndex) => {
        console.log(`Processing chore: ${chore.name}`);        

        // Use `days` instead of `day`
        const specificDayIndexes =
          Array.isArray(chore.days) && chore.days.length > 0
            ? chore.days
                .map((day) => {
                  const dayIndex = this.getDayIndex(day.trim());                  
                  return dayIndex;
                })
                .filter((index) => index !== -1) // Only valid indexes
            : null;

        console.log("Specific day indexes:", specificDayIndexes);

        if (specificDayIndexes && specificDayIndexes.length === 0) {
          console.error(
            `Invalid days for chore: ${chore.name}, Days: ${chore.days}`,
          );
        }

        return this.renderChoreRow(
          chore,
          rowIndex,
          "weekly",
          orderedIndexes,
          (dayIndex, hasValue) => {    
            // Disable all days except the specific ones if days are set
            if (specificDayIndexes !== null) {
              const isEnabled =
                specificDayIndexes.includes(dayIndex) || hasValue;              
              return !isEnabled;
            }

            // If no specific days are set, disable the row if a selection exists
            const isRowDisabled =
              chore.selections && chore.selections.some((sel) => sel);

            console.log(
              `Row for chore "${chore.name}" ${
                isRowDisabled ? "disabled" : "enabled"
              }`,
            );
            return isRowDisabled && !hasValue;
          },
        );
      })
      .join("");
    
    return html;
  }

  renderMonthlyChores(header, chores) {
    const orderedIndexes = this.getOrderedDayIndexes();
    if (!orderedIndexes) return "";

    const currentWeekOfMonth = this.getCurrentWeekOfMonth();

    let html = `<div class="section-header">${header}</div>`;

    html += chores
      .map((chore, rowIndex) => {
        const maxDays = chore.max_days || 1;
        const isInCorrectWeek =
          chore.week_of_month &&
          chore.week_of_month.week === currentWeekOfMonth;

        chore.highlightColor =
          chore.week_of_month && isInCorrectWeek
            ? chore.week_of_month.highlight_color || "transparent"
            : "transparent";

        return this.renderChoreRow(
          chore,
          rowIndex,
          "monthly",
          orderedIndexes,
          (dayIndex, hasValue) => {
            const isMaxDaysReached =
              chore.selections?.filter((sel) => sel).length >= maxDays;

            return (
              (isMaxDaysReached || (chore.week_of_month && !isInCorrectWeek)) &&
              !hasValue
            );
          },
        );
      })
      .join("");

    return html;
  }

  renderChoreRow(chore, rowIndex, section, orderedIndexes, isDisabledCallback) {
    return `
        <div class="chore-row">
            <div class="chore-name"style="background-color: ${
                  chore.highlightColor || "transparent"
                };">${chore.name}</div>
            <div class="chore-selections">
                ${orderedIndexes
                  .map((dayIndex) => {
                    const hasValue =
                      chore.selections &&
                      chore.selections[dayIndex] &&
                      chore.selections[dayIndex] !== "";
                    const isDisabled = isDisabledCallback(dayIndex, hasValue);

                    return `
                        <div class="grid-cell">
                            <select class="user-dropdown" 
                                    data-section="${section}" 
                                    data-row="${rowIndex}" 
                                    data-day="${dayIndex}" 
                                    ${isDisabled ? "disabled" : ""}
                                    onchange="this.getRootNode().host.handleDropdownChange(event)">
                                <option value="">--</option>
                                ${this.users
                                  .map(
                                    (user) =>
                                      `<option value="${user.name}" ${
                                        hasValue &&
                                        chore.selections[dayIndex] === user.name
                                          ? "selected"
                                          : ""
                                      }>${user.name}</option>`).join("")}
                            </select>
                        </div>
                    `;
                  }).join("")}
            </div>
        </div>
    `;
  }

  getCurrentWeekOfMonth() {
    const now = new Date();
    const firstDayOfWeek = this.normalizeDayName(this.firstDayOfWeek || "Monday"); // Default to Monday if not set
    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const firstDayIndex = shortDays.indexOf(firstDayOfWeek);

    if (firstDayIndex === -1) {
      console.error("Invalid first_day_of_week:", firstDayOfWeek);
      return null;
    }

    // Step 1: Find the most recent `first_day_of_week`
    const mostRecentDay = new Date(now);
    while (mostRecentDay.getDay() !== firstDayIndex) {
      mostRecentDay.setDate(mostRecentDay.getDate() - 1);
    }

    // Step 2: Find the first `first_day_of_week` of the month of `mostRecentDay`
    const firstDayOfMonth = new Date(
      mostRecentDay.getFullYear(),
      mostRecentDay.getMonth(),
      1,
    );
    const firstWeekDayOfMonth = new Date(firstDayOfMonth);
    while (firstWeekDayOfMonth.getDay() !== firstDayIndex) {
      firstWeekDayOfMonth.setDate(firstWeekDayOfMonth.getDate() + 1);
    }

    // Step 3: Calculate the difference in days
    const diffInDays = Math.floor(
      (mostRecentDay - firstWeekDayOfMonth) / (1000 * 60 * 60 * 24),
    );

    // Step 4: Convert to weeks
    return Math.floor(diffInDays / 7) + 1;
  }

  renderScorecard() {
    if (!this.users || this.users.length === 0) {
      return '<div class="scorecard"><div class="user-scores-row">No users available</div></div>';
    }

    const userScores = this.users
      .map((user) => {
        // Ensure user exists in userPoints; default to 0 points if not
        const points = this.userPoints[user.name] || 0;

        // Fallback for missing background color
        const backgroundColor = user.background_color || "transparent";
        const fontColor = user.font_color || "white";

        return `
                        <div class="user-score" style="background-color: ${backgroundColor}; color: ${fontColor};">
                            <strong>${user.name}: ${points}</strong>
                        </div>`;
      })
      .join("");

    return `
                <div class="scorecard">
                    <div class="user-scores-row">
                        ${userScores}
                    </div>
                </div>
            `;
  }

  handleDropdownChange(event) {
    const dropdown = event.target;
    const section = dropdown.dataset.section;
    const rowIndex = parseInt(dropdown.dataset.row, 10);
    const dayIndex = parseInt(dropdown.dataset.day, 10);
    const selectedValue = dropdown.value;

    // Ensure chore and selections are properly initialized
    const chore = this.data[section][rowIndex];
    if (!chore) {
      console.error(
        `Chore not found for section: ${section}, rowIndex: ${rowIndex}`,
      );
      return;
    }

    const points = chore.points || 0;
    chore.selections = chore.selections || Array(7).fill(null);

    // Track the previous value
    const previousValue = chore.selections[dayIndex];

    // No changes, exit early
    if (previousValue === selectedValue) {
      console.log(
        `No change detected for dayIndex: ${dayIndex}, section: ${section}, rowIndex: ${rowIndex}`,
      );
      return;
    }

    // Update the selection
    chore.selections[dayIndex] = selectedValue;

    // Adjust points for the previous user (if any)
    if (previousValue && this.userPoints[previousValue] !== undefined) {
      this.userPoints[previousValue] -= points;
      if (this.userPoints[previousValue] < 0) {
        this.userPoints[previousValue] = 0; // Prevent negative points
      }
    }

    // Adjust points for the new user (if any)
    if (selectedValue) {
      this.userPoints[selectedValue] =
        (this.userPoints[selectedValue] || 0) + points;
    }

    console.log(`Updated Points:`, this.userPoints);

    // Save the updated state to Home Assistant
    this.saveStateToHomeAssistant();

    // Re-render the card to reflect updated scores
    this.render();
  }
}

if (!customElements.get("chore-card")) {
  customElements.define("chore-card", ChoreCard);
}

