import * as jsYaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';

const BASE_PATH = '/hacsfiles/chore-card/';

export class ChoreCard extends HTMLElement {
  constructor() {
    super();
    console.log('Chore Card created');    

    this.attachShadow({ mode: 'open' });

    // Default values for the card configuration
    this.firstDayOfWeek = 'Mon'; // Default: Monday
    this.showLongDayNames = false; // Default: short day names
    this.pointsPosition = 'top'; // Default: points displayed at the top
    this.dayHeaderBackgroundColor = 'blue'; // Default: blue background
    this.dayHeaderFontColor = 'white'; // Default: white text

    // Default values for other state-related properties
    this.data = {}; // Default: no chore data
    this.users = []; // Default: no users
    this.userPoints = {}; // Default: no points tracked
    this.lastReset = null; // Default: no reset date
    this.lastSavedState = null; // Default: no saved state loaded
    this.initialized = false; // Initialize as false

    // Dynamically determine base URL and card ID
    this.apiBaseUrl = this.getAttribute('api-base-url') || ''; // Default: Home Assistant API
    let storedCardId = localStorage.getItem(`chore-card-id-${this.cardId}`);
    if (storedCardId) {
      this.cardId = storedCardId;
    } else {
      // Generate and save a new ID if not present
      storedCardId = `chore-card-${Date.now()}`;
      this.cardId = storedCardId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      localStorage.setItem(`chore-card-id-${this.cardId}`, this.cardId);
    }
    console.log(`Sanitized cardId: ${this.cardId}`);

    // Placeholder for Home Assistant token
    this.haToken = null; // Default to null until hass is set    

    // Dynamically resolve paths
    this.cssPath = `${BASE_PATH}chore-card.css`;

    // Initialize the card state and render
    this.initializeCard()
        .catch((error) => console.error('Error initializing ChoreCard:', error));
  }

  async initializeCard() {
    try {
        console.log('Initializing Chore Card...');

        // Load YAML configuration
        const yamlData = this.config || {};
        console.log('YAML data:', yamlData);        

        // Load state from Home Assistant if a token is available
        if (this.haToken) {
            await this.loadStateFromHomeAssistant(yamlData);
        } else {
            console.warn('No Home Assistant token available; skipping state loading.');
        }

        this.checkForReset();
        this.render();
        console.log('Card initialization complete.');
    } catch (error) {
        console.error('Error during card initialization:', error);
    }
  }

  setConfig(config) {
    // Validate and apply the configuration
    if (!config || !config.type) {
      throw new Error('Invalid card configuration');
    }
  
    this.config = config;
  
    // Set configuration options with defaults
    this.firstDayOfWeek = config.first_day_of_week || 'Mon';
    this.showLongDayNames = config.show_long_day_names || false;
    this.pointsPosition = config.points_position || 'top';
    this.dayHeaderBackgroundColor = config.day_header_background_color || 'blue';
    this.dayHeaderFontColor = config.day_header_font_color || 'white';
  
    console.log('Configuration set:', this.config);
  
    // Render the card after applying the config
    this.render();
  }
  

  getCardSize() {
    // Return an estimate of the card's height in rows
    return 5; // Adjust based on your card's layout
  }


  // Add the CSS file to the shadowRoot
  attachStyles() {
    const link = document.createElement('link');
    link.type = "text/css";
    link.rel = 'stylesheet';
    link.href = this.cssPath;
    this.shadowRoot.appendChild(link);
  }

  set hass(hass) {
    this._hass = hass;
    
    if (!this.initialized && hass) {
        try {
            // Correct token retrieval path
            this.haToken = hass.auth?.data?.access_token || null;

            if (this.haToken) {
                console.log('Successfully retrieved Home Assistant token:', this.haToken);
            } else {
                console.warn('Home Assistant token is not available.');
            }

            // Determine the API base URL
            this.apiBaseUrl = hass.auth?.data?.hassUrl || '';
            if (this.apiBaseUrl) {
                console.log('Using API base URL:', this.apiBaseUrl);
            } else {
                console.warn('API base URL is not available.');
            }

            // Additional setup or initialization
            this.initializeCard();
            this.initialized = true;
        } catch (error) {
            console.error('Error retrieving Home Assistant token or base URL:', error);
        }
    }
  }

  get hass() {
    return this._hass;
  }
  
  disconnectedCallback() {
    console.log(`Card disconnected. Checking if card is being deleted for cardId: ${this.cardId}`);

    // Delay to confirm if the card is actually being deleted
    setTimeout(() => {
        if (!document.body.contains(this)) {
            console.log(`Card deletion confirmed for cardId: ${this.cardId}`);

            // Remove the card ID from localStorage
            localStorage.removeItem(`chore-card-id-${this.cardId}`);

            // API call to delete the sensor entity
            const deleteUrl = `${this.apiBaseUrl}/api/states/sensor.${this.cardId}`;
            fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.haToken}`,
                },
            })
            .then((response) => {
                if (response.ok) {
                    console.log(`Sensor entity sensor.${this.cardId} deleted successfully.`);
                } else {
                    console.error(`Failed to delete sensor entity sensor.${this.cardId}: ${response.statusText}`);
                }
            })
            .catch((error) => {
                console.error(`Error deleting sensor entity sensor.${this.cardId}:`, error);
            });
        } else {
            console.log(`Card disconnection was temporary for cardId: ${this.cardId}`);
        }
    }, 100); // Delay for 100ms to allow DOM updates

    // Call parent disconnectedCallback if needed
    super.disconnectedCallback && super.disconnectedCallback();
  }

  createDefaultState(yamlData) {
    console.log('Creating default state...');
    
    // Set constructor variables directly from YAML or fallback to defaults
    this.firstDayOfWeek = yamlData.first_day_of_week
        ? this.normalizeDayName(yamlData.first_day_of_week)
        : 'Mon';
    this.showLongDayNames = yamlData.show_long_day_names || false;
    this.pointsPosition = yamlData.points_position || 'bottom';
    this.dayHeaderBackgroundColor = yamlData.day_header_background_color || 'blue';
    this.dayHeaderFontColor = yamlData.day_header_font_color || 'white';

    this.users = yamlData.users || []; // Default to empty array
    this.data = yamlData.chores || []; // Default to empty array

    // Construct and return the default state object
    const defaultState = {
        cardId: this.cardId,    
        firstDayOfWeek: this.firstDayOfWeek,
        showLongDayNames: this.showLongDayNames,
        pointsPosition: this.pointsPosition,
        dayHeaderBackgroundColor: this.dayHeaderBackgroundColor,
        dayHeaderFontColor: this.dayHeaderFontColor,  
        lastReset: this.lastReset || null,  
        users: this.users,
        userPoints: {},
        data: this.data,
    };

    console.log('Default state created:', defaultState);
    return defaultState;
  }

  async loadStateFromHomeAssistant(yamlData) {
    const stateUrl = `${this.apiBaseUrl}/api/states/sensor.${this.cardId}`;
    console.log(`Attempting to load state for: ${stateUrl}`);

    let savedState;

    try {
        const response = await fetch(stateUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.haToken}`,
            },
        });

        console.log('Response to parse:', response);

        if (response.ok) {
          const sensorState = await response.json();
          console.log('Raw state response:', sensorState);

          savedState = sensorState.attributes; // Only parse attributes
          console.log('Parsed saved state:', savedState);

          // Ensure savedState is valid before proceeding
          if (!savedState || typeof savedState !== 'object') {
              throw new Error('Invalid saved state format.');
          }

          this.lastSavedState = savedState; // Assign saved state            
        } else if (response.status === 404) {
            console.warn(`No saved state found for card: ${this.cardId}`);
            throw new Error('State not found (404).'); // Trigger catch block for consistency
        } else {
            throw new Error(`Failed to load state: ${response.statusText}`);
        }
    } 
    catch (error) {
        console.error('Error loading state:', error);

        // Create default state and assign it
        savedState = this.createDefaultState(yamlData);
        console.log('Creating default state due to error:', savedState);

        // Save the newly created default state back to Home Assistant
        try {
            this.lastSavedState = savedState;
            await this.saveStateToHomeAssistant();
            console.log('Default state saved to Home Assistant.');
            savedState = this.lastSavedState;
        } catch (saveError) {
            console.error('Failed to save default state to Home Assistant:', saveError);
        }
    }

    // Verify and update options
    const optionsChanged = this.checkAndUpdateOptions(yamlData, savedState);
    const usersChanged = this.checkAndUpdateUsers(yamlData, savedState);
    const choresChanged = this.checkAndUpdateChores(yamlData, savedState);

    if (optionsChanged || usersChanged || choresChanged) {
        console.log('Options updated. Saving updated state...');
        this.lastSavedState = savedState;
        await this.saveStateToHomeAssistant();
    } else {
        console.log('Options are consistent. No update needed.');
    }

    return savedState;
  }

  async saveStateToHomeAssistant() {
    if (!this.haToken) {
        console.warn('No token available. State changes will not be saved to Home Assistant.');
        return;
    }

    const stateUrl = `${this.apiBaseUrl}/api/states/sensor.${this.cardId}`;
    console.log(`Saving state to: ${stateUrl}`);

    try {
        // Prepare the state payload
        const state = {
            cardId: this.cardId,
            data: this.data || {}, // Chore data
            userPoints: this.userPoints || {}, // User points
            lastReset: this.lastReset || null, // Last reset date
            firstDayOfWeek: this.firstDayOfWeek, // Option
            showLongDayNames: this.showLongDayNames, // Option
            pointsPosition: this.pointsPosition, // Option
            dayHeaderBackgroundColor: this.dayHeaderBackgroundColor, // Option
            dayHeaderFontColor: this.dayHeaderFontColor, // Option
            users: this.users || [], // Users
        };

        console.log('State to be saved:', state);

        // Check if a friendly_name exists, fallback to title from YAML
        const friendlyName = this.config.friendly_name || this.config.title || 'Chore Card';

        // Construct the payload for the POST request
        const payload = {
          state: "active", // Use a valid string to represent the sensor's state
          attributes: {
              ...state, // Include the state data in the attributes field
              friendly_name: friendlyName, // Optional: add a human-readable name
          },
        };

        console.log('Payload to be sent:', payload);

        // Send POST request
        const response = await fetch(stateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.haToken}`, // Include the token
            },
            body: JSON.stringify(payload),
        });

        // Handle the response
        if (!response.ok) {
            const errorDetails = await response.text();
            console.error(`Failed to save state: ${response.status} ${response.statusText}`);
            console.error('Error details:', errorDetails);
            throw new Error(`Failed to save state: ${response.statusText}`);
        }
        
        console.log(`State saved successfully for card: ${this.cardId}`);
        this.lastSavedState = state; // Update the in-memory saved state
    } catch (error) {
        console.error(`Error saving state for card: ${this.cardId}`, error);
    }
  }

  checkAndUpdateOptions(yamlData, savedState) {
    console.log('Checking and updating options...');
    const stateOptions = [
        { yamlKey: 'first_day_of_week', stateKey: 'firstDayOfWeek' },
        { yamlKey: 'show_long_day_names', stateKey: 'showLongDayNames' },
        { yamlKey: 'points_position', stateKey: 'pointsPosition' },
        { yamlKey: 'day_header_background_color', stateKey: 'dayHeaderBackgroundColor' },
        { yamlKey: 'day_header_font_color', stateKey: 'dayHeaderFontColor' },
    ];

    let optionsChanged = false;

    console.log('Saved state before update:', savedState);

    // Ensure savedState is initialized and has a valid structure
    if (!savedState || typeof savedState !== 'object') {
      savedState = {}; // Initialize it as an empty object
    }

    console.log('Saved state after update:', savedState);

    stateOptions.forEach(({ yamlKey, stateKey }) => {
        let yamlValue = yamlData[yamlKey];
        let savedValue = savedState[stateKey];

        // Normalize `first_day_of_week`
        if (stateKey === 'firstDayOfWeek') {            
          yamlValue = yamlValue ? this.normalizeDayName(yamlValue) : 'Mon';
          savedValue = savedValue ? this.normalizeDayName(savedValue) : 'Mon';            
        }

        // Validate CSS colors for background and font
        if (
            (stateKey === 'dayHeaderBackgroundColor' || stateKey === 'dayHeaderFontColor') &&
            !this.isValidCssColor(yamlValue)
        ) {
            console.warn(`Invalid CSS color for ${stateKey}: ${yamlValue}. Falling back to default.`);
            yamlValue = stateKey === 'dayHeaderBackgroundColor' ? 'blue' : 'white'; // Defaults
        }

        // If YAML and saved state values are different, mark as changed
        if (yamlValue !== savedValue) {
            console.log(`Option changed: ${stateKey} from ${savedValue} to ${yamlValue}`);
            savedState[stateKey] = yamlValue; // Update the saved state with the YAML value
            optionsChanged = true;
        }

        // Always update the constructor variables
        this[stateKey] = yamlValue || this[stateKey];
    });

    console.log(
        'Options updated:',
        this.firstDayOfWeek,
        this.showLongDayNames,
        this.pointsPosition,
        this.dayHeaderBackgroundColor,
        this.dayHeaderFontColor
    );

    return optionsChanged;
  }

  checkAndUpdateUsers(yamlData, savedState) {
    console.log('Checking and updating users...');

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
                            selection === savedUser.name ? null : selection
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
          : 'transparent';

      const validatedFont = this.isValidCssColor(yamlUser.font_color)
      ? yamlUser.font_color
      : 'white';
  
      if (!savedUser) {
          console.log(`Adding new user: ${yamlUser.name}`);
          savedUsers.push({ name: yamlUser.name, background_color: validatedColor, font_color: validatedFont});
          savedState.userPoints[yamlUser.name] = 0; // Initialize points for new user
          usersChanged = true;
      } else if (savedUser.background_color !== validatedColor || savedUser.font_color != validatedFont) {
          console.log(`Updating color for user: ${yamlUser.name}`);
          savedUser.background_color = validatedColor; // Update the color
          savedUser.font_color = validatedFont
          usersChanged = true;
      }
    });

    // Ensure the saved state and constructor values are synchronized
    if (usersChanged || !this.users.length) {
        console.log('Applying updated users to constructor...');
        this.users = [...savedUsers]; // Update the constructor's users
        savedState.users = [...savedUsers]; // Sync savedState users
        this.userPoints = { ...savedState.userPoints }; // Sync points
    }

    console.log('Users updated:', this.users);
    return usersChanged;
  }

  checkAndUpdateChores(yamlData, savedState) {
    console.log('Checking and updating chores...');
    console.log('Before update, this.data:', this.data);
    console.log('Is this.data frozen:', Object.isFrozen(this.data));

    // If this.data is frozen, create a mutable copy
    if (Object.isFrozen(this.data)) {
        this.data = JSON.parse(JSON.stringify(this.data));
        console.log('Created a mutable copy of this.data:', this.data);
    }

    const choreSections = ['daily', 'weekly', 'monthly'];
    let choresChanged = false;

    savedState.data = savedState.data ? JSON.parse(JSON.stringify(savedState.data)) : {};

    choreSections.forEach((section) => {
        const yamlChores = yamlData.chores?.[section] || [];
        savedState.data[section] = savedState.data[section] || []; // Ensure section exists
        const savedChores = [...savedState.data[section]];

        const yamlChoreMap = new Map(yamlChores.map((chore) => [chore.name, chore]));
        const savedChoreMap = new Map(savedChores.map((chore) => [chore.name, chore]));

        const updatedChores = [];

        yamlChores.forEach((yamlChore) => {
            const savedChore = savedChoreMap.get(yamlChore.name);

            if (!savedChore) {
                console.log(`Adding new chore: ${yamlChore.name}`);
                updatedChores.push({ ...yamlChore, selections: Array(7).fill(null) });
                choresChanged = true;
            } else {
                let choreUpdated = false;

                if (yamlChore.points !== savedChore.points) {
                    console.log(`Updating points for chore: ${yamlChore.name}`);
                    savedChore.selections?.forEach((user) => {
                        if (user) {
                            savedState.userPoints[user] += (yamlChore.points || 0) - (savedChore.points || 0);
                        }
                    });
                    savedChore.points = yamlChore.points;
                    choreUpdated = true;
                }

                if (section === 'weekly') {
                  const normalizedDays = this.normalizeDays(yamlChore.days); // Handle multiple days
              
                  if (JSON.stringify(normalizedDays) !== JSON.stringify(savedChore.days)) {
                      console.log(`Days changed for weekly chore: ${yamlChore.name}`);
                      savedChore.selections = Array(7).fill(null); // Clear all user selections
                      savedChore.days = normalizedDays; // Update to the new days
                      choreUpdated = true;
                  }
                }
              
                if (section === 'monthly') {
                    if (yamlChore.week_of_month?.week !== savedChore.week_of_month?.week) {
                        console.log(`Week of month changed for monthly chore: ${yamlChore.name}`);
                        savedChore.selections = Array(7).fill(null);
                        savedChore.week_of_month = { ...yamlChore.week_of_month };
                        choreUpdated = true;
                    }
                    if (yamlChore.max_days !== savedChore.max_days) {
                        console.log(`Max days changed for monthly chore: ${yamlChore.name}`);
                        if ((yamlChore.max_days || 0) < (savedChore.max_days || 0)) {
                            savedChore.selections = Array(7).fill(null);
                        }
                        savedChore.max_days = yamlChore.max_days;
                        choreUpdated = true;
                    }
                    if (yamlChore.week_of_month?.highlight_color !== savedChore.week_of_month?.highlight_color) {
                        const validatedHighlightColor = this.isValidCssColor(yamlChore.week_of_month.highlight_color)
                            ? yamlChore.week_of_month.highlight_color
                            : 'transparent';

                        console.log(`Highlight color changed for monthly chore: ${yamlChore.name} to ${validatedHighlightColor}`);
                        savedChore.week_of_month.highlight_color = validatedHighlightColor;
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

    console.log('Chores updated:', this.data);
    return choresChanged;
  }

  normalizeDayName(dayName) {
    if (!dayName || typeof dayName !== 'string') {
      console.warn('Invalid day name:', dayName);
      return undefined;
    }
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const longDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const normalizedDay = dayName.toLowerCase();
    const shortIndex = shortDays.findIndex((day) => day.toLowerCase() === normalizedDay);
    const longIndex = longDays.findIndex((day) => day.toLowerCase() === normalizedDay);

    if (shortIndex !== -1) return shortDays[shortIndex];
    if (longIndex !== -1) return shortDays[longIndex];

    // Return undefined for invalid days
    console.warn(`Invalid day name: ${dayName}`);
    return undefined;
  }

  normalizeDays(days) {
    if (!days) return [];
    // Split on commas and normalize each day
    return days.split(',').map(day => this.normalizeDayName(day)).filter(Boolean);
  }

  isValidCssColor(color) {
    const s = new Option().style;
    s.color = color;
    return s.color !== '';
  }

  getOrderedDayIndexes() {
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const longDays = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ];

    // Find the starting index based on `firstDayOfWeek`
    const startIndex = shortDays.indexOf(this.firstDayOfWeek) !== -1
        ? shortDays.indexOf(this.firstDayOfWeek)
        : longDays.indexOf(this.firstDayOfWeek);

    if (startIndex === -1) {
        console.error('Invalid first_day_of_week:', this.firstDayOfWeek);
        return null;
    }

    // Return ordered indexes starting from `firstDayOfWeek`
    const orderedIndexes = [...Array(7).keys()].map((i) => (startIndex + i) % 7);
    return orderedIndexes;
  }

  getDayIndex(dayName) {
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const longDays = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ];

    const lowerDay = dayName.toLowerCase();

    const shortIndex = shortDays.findIndex(
        (day) => day.toLowerCase() === lowerDay
    );
    const longIndex = longDays.findIndex(
        (day) => day.toLowerCase() === lowerDay
    );

    if (shortIndex !== -1) return shortIndex;
    if (longIndex !== -1) return longIndex;

    console.error(`Invalid day name: ${dayName}`);
    return -1; // Return -1 if day name is invalid
  }


  async checkForReset() {
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0]; // Current date as a string
    const firstDayOfWeekIndex = this.getDayIndex(this.firstDayOfWeek);
    const todayIndex = today.getDay();

    // Only reset on the first day of the week
    if (todayIndex === firstDayOfWeekIndex) {
        if (!this.lastReset || this.lastReset !== todayDateString) {
            console.log(`Resetting chores for card: ${this.cardId}`);
            await this.resetWeeklyChores(); // Reset weekly chores
            this.lastReset = todayDateString; // Update last reset date            
        } else {
            console.log('Already reset for today. No action taken.');
        }
    } else {
        console.log(`Not the first day of the week (${this.firstDayOfWeek}). No reset needed.`);
    }
  }

  async resetWeeklyChores() {
    console.log('Resetting all chores for the new week...');
    
    // Step 1: Archive current state
    const archiveUrl = `${this.apiBaseUrl}/api/states/sensor.${this.cardId}_archive`;
    const archiveData = {
        timestamp: new Date().toISOString(),
        data: this.data,
        userPoints: this.userPoints,
        lastReset: this.lastReset,
    };

    try {
        console.log('Archiving current state...');
        const response = await fetch(archiveUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.haToken}`,
            },
            body: JSON.stringify({ state: JSON.stringify(archiveData) }),
        });

        if (!response.ok) {
            throw new Error(`Failed to archive state: ${response.statusText}`);
        }

        console.log('State archived successfully.');
    } catch (error) {
        console.error('Error archiving state:', error);
    }

    // Step 2: Clear all chore selections
    console.log('Clearing all chore selections...');
    ['daily', 'weekly', 'monthly'].forEach((section) => {
        if (this.data[section]) {
            this.data[section].forEach((chore) => {
                chore.selections = Array(7).fill(null); // Reset selections
            });
        }
    });

    // Step 3: Reset user points
    console.log('Resetting user points...');
    Object.keys(this.userPoints).forEach((user) => {
        this.userPoints[user] = 0;
    });

    // Step 4: Save the reset state to Home Assistant
    console.log('Saving reset state...');
    await this.saveStateToHomeAssistant();

    // Step 5: Re-render the UI
    console.log('Re-rendering card...');
    this.render();
  }

  render() {
    // Clear the existing content
    this.shadowRoot.innerHTML = '';

    // Attach styles dynamically
    this.attachStyles();

    // Prepare the grid content
    const scorecard = this.renderScorecard();
    const gridContent = `
        <div class="card">
            ${this.pointsPosition === 'top' ? scorecard : ''}
            <div class="grid">
                ${this.renderWeekDays()} <!-- Render the days of the week -->
                <div class="empty-row"></div>
                ${this.data.daily ? this.renderChoreGrid('Daily Chores', this.data.daily, 'daily') : ''}
                ${this.data.weekly ? this.renderChoreGrid('Weekly Chores', this.data.weekly, 'weekly') : ''}
                ${this.data.monthly ? this.renderChoreGrid('Monthly Chores', this.data.monthly, 'monthly') : ''}
            </div>
            ${this.pointsPosition === 'bottom' ? scorecard : ''}
        </div>
    `;

    // Create a container for proper width handling
    const container = document.createElement('div');
    container.classList.add('container');
    container.innerHTML = gridContent;

    // Append the container to the shadow DOM
    this.shadowRoot.appendChild(container);
  }

  renderWeekDays() {
    const orderedIndexes = this.getOrderedDayIndexes();
    if (!orderedIndexes) return '<div class="day-header">Invalid Week Start</div>';

    const daysOfWeek = this.showLongDayNames
        ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const dayHeaders = orderedIndexes.map(
        (index) =>
            `<div class="day-header" style="background-color: ${this.dayHeaderBackgroundColor}; color: ${this.dayHeaderFontColor};">${daysOfWeek[index]}</div>`
    );

    // Add a transparent placeholder column at the start
    dayHeaders.unshift(
        `<div class="day-header empty" style="background-color: transparent; border: none;"></div>`
    );

    return dayHeaders.join('');
  }

  renderChoreGrid(header, chores, section) {
    if (!chores || chores.length === 0) return '';

    switch (section) {
        case 'daily':
            return this.renderDailyChores(header, chores);
        case 'weekly':
            return this.renderWeeklyChores(header, chores);
        case 'monthly':
            return this.renderMonthlyChores(header, chores);
        default:
            console.error(`Unknown section: ${section}`);
            return '';
    }
  }

  renderDailyChores(header, chores) {
    const orderedIndexes = this.getOrderedDayIndexes();
    if (!orderedIndexes) return '';

    let html = `<div class="section-header">${header}</div>`;

    html += chores
        .map((chore, rowIndex) =>
            this.renderChoreRow(
                chore,
                rowIndex,
                'daily',
                orderedIndexes,
                () => false // Daily chores have no disabling logic
            )
        )
        .join('');

    return html;
  }

  renderWeeklyChores(header, chores) {
    const orderedIndexes = this.getOrderedDayIndexes();
    if (!orderedIndexes) return '';

    let html = `<div class="section-header">${header}</div>`;

    html += chores
        .map((chore, rowIndex) => {
            const specificDayIndexes = 
                chore.day ? 
                chore.day.split(',').map((day) => this.getDayIndex(day.trim())).filter((index) => index !== -1) : 
                null;

            if (chore.day && specificDayIndexes.length === 0) {
                console.error(`Invalid day value(s) for chore: ${chore.name}, Days: ${chore.day}`);
            }

            return this.renderChoreRow(
                chore,
                rowIndex,
                'weekly',
                orderedIndexes,
                (dayIndex, hasValue) => {
                    // Disable all days except the specific ones if days are set
                    if (specificDayIndexes !== null) {
                        return !specificDayIndexes.includes(dayIndex) && !hasValue;
                    }

                    // If no specific days, disable the row if a selection exists
                    const isRowDisabled =
                        chore.selections && chore.selections.some((sel) => sel);

                    return isRowDisabled && !hasValue;
                }
            );
        })
        .join('');

    return html;
  }

  renderMonthlyChores(header, chores) {
    const orderedIndexes = this.getOrderedDayIndexes();
    if (!orderedIndexes) return '';

    const currentWeekOfMonth = this.getCurrentWeekOfMonth();

    let html = `<div class="section-header">${header}</div>`;

    html += chores
        .map((chore, rowIndex) => {
            const maxDays = chore.max_days || 1;
            const isInCorrectWeek =
                chore.week_of_month &&
                chore.week_of_month.week === currentWeekOfMonth;

            chore.highlightColor =
                chore.week_of_month &&
                isInCorrectWeek
                    ? chore.week_of_month.highlight_color || 'transparent'
                    : 'transparent';

            return this.renderChoreRow(
                chore,
                rowIndex,
                'monthly',
                orderedIndexes,
                (dayIndex, hasValue) => {
                    const isMaxDaysReached =
                        chore.selections?.filter((sel) => sel).length >= maxDays;

                    return (
                        (isMaxDaysReached ||
                            (chore.week_of_month && !isInCorrectWeek)) &&
                        !hasValue
                    );
                }
              );
          })
          .join('');
  
    return html;
  }

  renderChoreRow(chore, rowIndex, section, orderedIndexes, isDisabledCallback) {
    return `
        <div class="chore-name" style="background-color: ${
            chore.highlightColor || 'transparent'
        };">${chore.name}</div>
        ${orderedIndexes
            .map((dayIndex) => {
                const hasValue =
                    chore.selections &&
                    chore.selections[dayIndex] &&
                    chore.selections[dayIndex] !== '';
                const isDisabled = isDisabledCallback(dayIndex, hasValue);

                return `
                    <div class="grid-cell">
                        <select class="user-dropdown" 
                                data-section="${section}" 
                                data-row="${rowIndex}" 
                                data-day="${dayIndex}" 
                                ${isDisabled ? 'disabled' : ''}
                                onchange="this.getRootNode().host.handleDropdownChange(event)">
                            <option value="">--</option>
                            ${this.users
                                .map(
                                    (user) =>
                                        `<option value="${user.name}" ${
                                            hasValue &&
                                            chore.selections[dayIndex] === user.name
                                                ? 'selected'
                                                : ''
                                        }>${user.name}</option>`
                                )
                                .join('')}
                        </select>
                    </div>
                `;
            })
            .join('')}
    `;
  }

  getCurrentWeekOfMonth() {
    const now = new Date();
    const firstDayOfWeek = this.firstDayOfWeek || 'Monday'; // Default to Monday if not set
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const firstDayIndex = shortDays.indexOf(firstDayOfWeek);

    if (firstDayIndex === -1) {
        console.error('Invalid first_day_of_week:', firstDayOfWeek);
        return null;
    }

    // Step 1: Find the most recent `first_day_of_week`
    const mostRecentDay = new Date(now);
    while (mostRecentDay.getDay() !== firstDayIndex) {
        mostRecentDay.setDate(mostRecentDay.getDate() - 1);
    }

    // Step 2: Find the first `first_day_of_week` of the month of `mostRecentDay`
    const firstDayOfMonth = new Date(mostRecentDay.getFullYear(), mostRecentDay.getMonth(), 1);
    const firstWeekDayOfMonth = new Date(firstDayOfMonth);
    while (firstWeekDayOfMonth.getDay() !== firstDayIndex) {
        firstWeekDayOfMonth.setDate(firstWeekDayOfMonth.getDate() + 1);
    }

    // Step 3: Calculate the difference in days
    const diffInDays = Math.floor((mostRecentDay - firstWeekDayOfMonth) / (1000 * 60 * 60 * 24));

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
            const backgroundColor = user.background_color || 'transparent';
            const fontColor = user.font_color || 'white';

            return `
                <div class="user-score" style="background-color: ${backgroundColor}; color: ${fontColor};">
                    <strong>${user.name}: ${points}</strong>
                </div>`;
        })
        .join('');

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
        console.error(`Chore not found for section: ${section}, rowIndex: ${rowIndex}`);
        return;
    }

    const points = chore.points || 0;
    chore.selections = chore.selections || Array(7).fill(null);

    // Track the previous value
    const previousValue = chore.selections[dayIndex];

    // No changes, exit early
    if (previousValue === selectedValue) {
        console.log(`No change detected for dayIndex: ${dayIndex}, section: ${section}, rowIndex: ${rowIndex}`);
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
        this.userPoints[selectedValue] = (this.userPoints[selectedValue] || 0) + points;
    }

    console.log(`Updated Points:`, this.userPoints);

    // Save the updated state to Home Assistant
    this.saveStateToHomeAssistant();

    // Re-render the card to reflect updated scores
    this.render();
  }
  
}

customElements.define('chore-card', ChoreCard);
