import * as jsYaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';

const BASE_PATH = '/hacsfiles/chore-card/';

export class ChoreCard extends HTMLElement {
  constructor() {
    super();
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
    this.cardId = this.getAttribute('card-id') || `chore-card-${Date.now()}`;

    // Placeholder for Home Assistant token
    this.haToken = null; // Default to null until hass is set
    if (this.hass?.connection?.auth?.token) {
        this.haToken = this.hass.connection.auth.token;
    }
    
    // Dynamically resolve paths
    this.scriptUrl = `${BASE_PATH}chore-card.js`;
    this.cssPath = `${BASE_PATH}chore-card.css`;

    // Initialize the card state and render
    this.initializeCard()
        .catch((error) => console.error('Error initializing ChoreCard:', error));
  }

  async initializeCard() {
    try {
        console.log('Initializing Chore Card...');

        // Load YAML configuration
        const yamlData = this.getAttribute('yaml-data') ? jsYaml.load(this.getAttribute('yaml-data')) : {};
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

    if (!this.initialized) {
        this.apiBaseUrl = hass.connection?.options?.baseUrl || '';
        this.haToken = hass.connection?.auth?.token || localStorage.getItem('haToken');

        // Save token to localStorage for fallback
        if (this.haToken) {
            localStorage.setItem('haToken', this.haToken);
        }

        this.initializeCard();
        this.initialized = true;
    }
  }

  get hass() {
    return this._hass;
  }
  
  async loadStateFromHomeAssistant(yamlData) {
    const stateUrl = `${this.apiBaseUrl}/api/states/sensor.${this.cardId}`;
    console.log(`Attempting to load state for: ${stateUrl}`);
    
    try {
      if (!this.haToken) {
        console.warn('No token available. Using default state.');
        this.lastSavedState = this.createDefaultState(yamlData);
        return;
      }
    
      const response = await fetch(stateUrl, {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.haToken}`,
          },
      });

      let savedState = null;

      if (response.ok) {
          const state = await response.json();
          savedState = JSON.parse(state.state);
          console.log('State loaded from Home Assistant:', savedState);
      } else if (response.status === 404) {
          console.warn(`No saved state found for card: ${this.cardId}`);
      } else {
          throw new Error(`Failed to load state: ${response.statusText}`);
      }

      // Use `checkAndUpdateOptions` to ensure the constructor variables are consistent
      const optionsChanged = this.checkAndUpdateOptions(yamlData, savedState);
      const usersChanged = this.checkAndUpdateUsers(yamlData, savedState);
      const choresChanged = this.checkAndUpdateChores(yamlData, savedState);

      if (optionsChanged || usersChanged || choresChanged) {
          console.log('Options updated. Saving updated state...');
          this.lastSavedState = savedState || this.createDefaultState(yamlData);
          await this.saveStateToHomeAssistant(); // Save the updated state
      } else {
          console.log('Options are consistent. No update needed.');
      }
    } catch (error) {
        console.error(`Error loading state for card: ${this.cardId}`, error);
    }
  }

  async saveStateToHomeAssistant() {
    if (!this.haToken) {
      console.warn('No token available. State changes will not be saved to Home Assistant.');
      return;
    }

    const stateUrl = `${this.apiBaseUrl}/api/states/sensor.${this.cardId}`;
    console.log(`Saving state to: ${stateUrl}`);

    try {
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

        const response = await fetch(stateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.haToken}`, // Include token if required
            },
            body: JSON.stringify({ state: JSON.stringify(state) }),
        });

        if (!response.ok) {
            throw new Error(`Failed to save state: ${response.statusText}`);
        }

        console.log(`State saved for card: ${this.cardId}`);
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

    stateOptions.forEach(({ yamlKey, stateKey }) => {
        let yamlValue = yamlData[yamlKey];
        let savedValue = savedState ? savedState[stateKey] : undefined;

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
  
      if (!savedUser) {
          console.log(`Adding new user: ${yamlUser.name}`);
          savedUsers.push({ name: yamlUser.name, background_color: validatedColor });
          savedState.userPoints[yamlUser.name] = 0; // Initialize points for new user
          usersChanged = true;
      } else if (savedUser.background_color !== validatedColor) {
          console.log(`Updating color for user: ${yamlUser.name}`);
          savedUser.background_color = validatedColor; // Update the color
          usersChanged = true;
      }
    });

    // Sort users alphabetically by name
    savedUsers.sort((a, b) => a.name.localeCompare(b.name));

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

    const choreSections = ['daily', 'weekly', 'monthly'];
    let choresChanged = false;

    // Ensure the `data` object exists in the saved state
    savedState.data = savedState.data || {};

    choreSections.forEach((section) => {
        const yamlChores = yamlData.chores?.[section] || [];
        savedState.data[section] = savedState.data[section] || []; // Ensure section exists
        const savedChores = savedState.data[section];

        const yamlChoreMap = new Map(yamlChores.map((chore) => [chore.name, chore]));
        const savedChoreMap = new Map(savedChores.map((chore) => [chore.name, chore]));

        // Handle removed chores
        savedChores.forEach((savedChore) => {
            if (!yamlChoreMap.has(savedChore.name)) {
                console.log(`Chore removed: ${savedChore.name}`);
                // Remove user points associated with the removed chore
                savedChore.selections?.forEach((user) => {
                    if (user) {
                        savedState.userPoints[user] -= savedChore.points || 0;
                    }
                });
                choresChanged = true;
            }
        });

        // Handle added or updated chores
        yamlChores.forEach((yamlChore) => {
            const savedChore = savedChoreMap.get(yamlChore.name);

            if (!savedChore) {
                console.log(`Adding new chore: ${yamlChore.name}`);
                savedState.data[section].push({ ...yamlChore, selections: Array(7).fill(null) }); // Initialize selections
                choresChanged = true;
            } else {
                // Handle updates to existing chores
                let choreUpdated = false;

                // Check points change
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

                // Weekly task: Check day change
                if (section === 'weekly') {
                  console.log(`Day value for weekly chore: ${yamlChore.day}`);
                  const normalizedDay = this.normalizeDayName(yamlChore.day);
              
                  if (normalizedDay !== savedChore.day) {
                      console.log(`Day changed or removed for weekly chore: ${yamlChore.name} Nornalixed ${normalizedDay} Saved ${savedChore.day}`);
                      savedChore.selections = Array(7).fill(null); // Clear all user selections
                      
                      if (normalizedDay) {
                          savedChore.day = normalizedDay; // Update to the new normalized day
                      } else {
                          delete savedChore.day; // Remove the day property if invalid
                      }
                      
                      choreUpdated = true;
                  }
                }
                
                // Monthly task: Check week_of_month changes
                if (section === 'monthly') {
                    if (yamlChore.week_of_month?.week !== savedChore.week_of_month?.week) {
                        console.log(`Week of month changed for monthly chore: ${yamlChore.name}`);
                        savedChore.selections = Array(7).fill(null); // Clear all user selections
                        savedChore.week_of_month = { ...yamlChore.week_of_month };
                        choreUpdated = true;
                    }
                    if (yamlChore.max_days !== savedChore.max_days) {
                        console.log(`Max days changed for monthly chore: ${yamlChore.name}`);
                        if ((yamlChore.max_days || 0) < (savedChore.max_days || 0)) {
                            savedChore.selections = Array(7).fill(null); // Clear all user selections
                        }
                        savedChore.max_days = yamlChore.max_days;
                        choreUpdated = true;
                    }
                    if (yamlChore.week_of_month?.highlight_color !== savedChore.week_of_month?.highlight_color) {
                      const validatedHighlightColor = this.isValidCssColor(yamlChore.week_of_month.highlight_color)
                          ? yamlChore.week_of_month.highlight_color
                          : 'transparent'; // Default to 'transparent' if invalid
                  
                      console.log(`Highlight color changed for monthly chore: ${yamlChore.name} to ${validatedHighlightColor}`);
                      savedChore.week_of_month.highlight_color = validatedHighlightColor;
                      choreUpdated = true;
                    }                  
                }

                if (choreUpdated) choresChanged = true;
            }
        });

        // Update constructor values for rendering
        this.data[section] = savedState.data[section] = savedChores.filter((chore) => yamlChoreMap.has(chore.name));
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
            const specificDayIndex =
                chore.day ? this.getDayIndex(chore.day) : null;

            if (specificDayIndex === -1 && chore.day) {
                console.error(`Invalid day value for chore: ${chore.name}, Day: ${chore.day}`);
            }

            return this.renderChoreRow(
                chore,
                rowIndex,
                'weekly',
                orderedIndexes,
                (dayIndex, hasValue) => {
                    // Disable all days except the specific one if day is set
                    if (specificDayIndex !== null) {
                        return dayIndex !== specificDayIndex && !hasValue;
                    }

                    // If no specific day, disable the row if a selection exists
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

            return `
                <div class="user-score" style="background-color: ${backgroundColor};">
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
